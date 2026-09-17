# update the image

## login
1. `aws sts get-caller-identity`
2. Login `aws configure`
   1. Set with the IAM access key and secret access key
3. Login into my ecr. Use the `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 864051219751.dkr.ecr.us-east-1.amazonaws.com`
   
4. Rebuild ``
```
docker build -t stream-ticker-app .
docker tag stream-ticker-app:latest 864051219751.dkr.ecr.us-east-1.amazonaws.com/stream-ticker-app:latest
docker push 864051219751.dkr.ecr.us-east-1.amazonaws.com/stream-ticker-app:latest
```