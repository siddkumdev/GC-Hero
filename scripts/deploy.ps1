$GCLOUD_CMD = "C:\Apps\GHero\google-cloud-sdk\bin\gcloud.cmd"
$PROJECT_ID = (& $GCLOUD_CMD config get-value project)
$REGION = "asia-south1"
$SERVICE_NAME = "gcheros"
$IMAGE = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Building and pushing container image..."
& $GCLOUD_CMD builds submit --tag $IMAGE

Write-Host "Deploying to Cloud Run..."
& $GCLOUD_CMD run deploy $SERVICE_NAME --image $IMAGE --platform managed --region $REGION --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 --clear-secrets --env-vars-file "env.yaml"

Write-Host "Deployed! Service URL:"
& $GCLOUD_CMD run services describe $SERVICE_NAME --region $REGION --format "value(status.url)"
