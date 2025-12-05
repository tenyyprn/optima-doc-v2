import { Construct } from "constructs";
import { RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";

export class Database extends Construct {
  public readonly imagesTable: Table;
  public readonly jobsTable: Table;
  public readonly schemasTable: Table;
  public readonly datacheckProjectsTable: Table;
  public readonly portCodesTable: Table;
  public readonly feedbackTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // 画像情報を保存するテーブル
    this.imagesTable = new Table(this, "ImagesTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // 開発環境用。本番環境では RETAIN にすべき
      pointInTimeRecovery: true,
    });

    // GSI を追加（アプリ名でのフィルタリング用）
    this.imagesTable.addGlobalSecondaryIndex({
      indexName: "AppNameIndex",
      partitionKey: { name: "app_name", type: AttributeType.STRING },
      sortKey: { name: "upload_time", type: AttributeType.STRING },
    });

    // ジョブ情報を保存するテーブル
    this.jobsTable = new Table(this, "JobsTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // 開発環境用
      pointInTimeRecovery: true,
    });

    // スキーマ情報を保存するテーブル
    this.schemasTable = new Table(this, "SchemasTable", {
      partitionKey: { name: "schema_type", type: AttributeType.STRING },
      sortKey: { name: "name", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // 開発環境用
      pointInTimeRecovery: true,
    });

    // データチェックプロジェクトテーブル
    this.datacheckProjectsTable = new Table(this, "DataCheckProjectsTable", {
      partitionKey: { name: "project_id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // ImagesTableにproject_id用のGSIを追加（データチェック用）
    this.imagesTable.addGlobalSecondaryIndex({
      indexName: "project_id-index",
      partitionKey: { name: "project_id", type: AttributeType.STRING },
      sortKey: { name: "upload_time", type: AttributeType.STRING },
    });

    // 港コードマスタテーブル
    this.portCodesTable = new Table(this, "PortCodesTable", {
      partitionKey: { name: "port_code", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // データチェックフィードバックテーブル
    this.feedbackTable = new Table(this, "DataCheckFeedbackTable", {
      partitionKey: { name: "feedback_id", type: AttributeType.STRING },
      sortKey: { name: "timestamp", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // GSI: project_idで検索できるように
    this.feedbackTable.addGlobalSecondaryIndex({
      indexName: "ProjectIdIndex",
      partitionKey: { name: "project_id", type: AttributeType.STRING },
      sortKey: { name: "timestamp", type: AttributeType.STRING },
    });

    // テーブル名を出力
    new CfnOutput(this, "ImagesTableName", {
      value: this.imagesTable.tableName,
      description: "DynamoDB Images Table Name",
    });

    new CfnOutput(this, "JobsTableName", {
      value: this.jobsTable.tableName,
      description: "DynamoDB Jobs Table Name",
    });

    new CfnOutput(this, "SchemasTableName", {
      value: this.schemasTable.tableName,
      description: "DynamoDB Schemas Table Name",
    });

    new CfnOutput(this, "DataCheckProjectsTableName", {
      value: this.datacheckProjectsTable.tableName,
      description: "DynamoDB DataCheck Projects Table Name",
    });

    new CfnOutput(this, "PortCodesTableName", {
      value: this.portCodesTable.tableName,
      description: "DynamoDB Port Codes Table Name",
    });

    new CfnOutput(this, "FeedbackTableName", {
      value: this.feedbackTable.tableName,
      description: "DynamoDB DataCheck Feedback Table Name",
    });
  }
}
