import os
from google.cloud import bigquery
import functions_framework


@functions_framework.http
def load_opa_properties(request):
    """
    HTTP 触发的 Cloud Function，用于执行加载 OPA 数据到 BigQuery 的 SQL 脚本。
    """
    # 初始化 BigQuery 客户端
    client = bigquery.Client()

    # 获取当前 Python 文件所在的目录，以便准确定位同目录下的 SQL 文件
    dir_path = os.path.dirname(os.path.realpath(__file__))

    try:
        # ==========================================
        # 1. 执行创建外部表的 SQL (Source)
        # ==========================================
        source_sql_path = os.path.join(dir_path, 'source_phl_opa_properties.sql')
        with open(source_sql_path, 'r') as file:
            source_sql = file.read()

        print("开始执行 source_phl_opa_properties.sql...")
        source_job = client.query(source_sql)
        source_job.result()  # 阻塞等待任务完成
        print("外部表 source.opa_properties 创建成功！")

        # ==========================================
        # 2. 执行创建内部表的 SQL (Core)
        # ==========================================
        core_sql_path = os.path.join(dir_path, 'core_phl_opa_properties.sql')
        with open(core_sql_path, 'r') as file:
            core_sql = file.read()

        print("开始执行 core_phl_opa_properties.sql...")
        core_job = client.query(core_sql)
        core_job.result()  # 阻塞等待任务完成
        print("内部表 core.opa_properties 创建成功！")

        return "Successfully loaded OPA properties into source and core datasets.", 200

    except Exception as e:
        print(f"执行 SQL 过程中发生错误: {e}")
        return f"Error executing BigQuery SQL: {e}", 500
    