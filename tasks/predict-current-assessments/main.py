import os
import functions_framework
from google.cloud import bigquery


@functions_framework.http
def predict_current_assessments(request):
    """
    HTTP-triggered Cloud Function:
    1. Train saleprice model using current_assessments_model_training_data
    2. Predict current assessment values for all residential properties
    3. Store results in derived.current_assessments
    """
    bq = bigquery.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    # Step 1: Train model
    train_sql_path = os.path.join(dir_path, 'train_model.sql')
    with open(train_sql_path) as f:
        train_sql = f.read()

    print("Training saleprice model...")
    bq.query(train_sql).result()
    print("Model trained.")

    # Step 2: Predict
    predict_sql_path = os.path.join(dir_path, 'predict_current_assessments.sql')
    with open(predict_sql_path) as f:
        predict_sql = f.read()

    print("Predicting current assessments...")
    bq.query(predict_sql).result()
    print("derived.current_assessments created.")

    return "Success", 200
