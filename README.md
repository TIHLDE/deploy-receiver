# About

## What?
This repository is intended for Drift and is a simple web server hosted on our virtual machines that will receive a notification from GitHub workflows
about a new deployment.

The GitHub workflows need a way to ping Drift's virtual machines and notify them that
"Hey! There is a new version of <insert-application-name> available that you need to deploy!"

This repo is the server that receives these notifications.

## How?

`server.js` is a simple (vibe-coded) HTTP server that exposes a `POST /deploy`-endpoint that the
GitHub workflows can hit when a new version is released.

After authenticating and validating the request it will run the appropriate `/home/debian/apps/<repo-name>/deploy.sh`-script, passing it the docker image that it should deploy as an argument. What the deploy.sh script does from here can vary from project to project.

## Environment Variables
The HTTP server (`server.js`) needs a *DEPLOY_TOKEN* environment variable. This should be placed in a `.env`. This is the token sent by the workflows in the POST request's `X-Deploy-Token`-header. This is used to authenticate the workflow by making sure the environment variable matches the value sent in the request's header.

## How to deploy to a new VM

- Use domeneshop and nginx on Chinstrap to configure a domain to point to port 4040 on your VM.
- Clone this repo to `/home/debian/` on the target VM. The directory `/home/debian/deploy-receiver/` should now exist.
- Create `/home/debian/deploy-receiver/.env` file and add the DEPLOY_TOKEN environment variable:
```env
DEPLOY_TOKEN=my-top-secret-deploy-token-that-can-be-found-on-vaultwarden
```
- Create a systemd service by creating a symlink in `/etc/systemd/system` that points to `deploy-receiver.service`.
```bash
sudo ln -s /etc/systemd/system/deploy-receiver.service /home/debian/deploy-receiver/deploy-receiver.service
```
- Reload systemd daemons (so it picks up the new deploy-receiver service), and enable and start the new deploy-receiver systemd service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now deploy-receiver.service

# Check if everything is looking good
sudo systemctl status deploy-receiver.service
```
- The receiver should now be listening for incoming deployment requests.

Useful commands:
```
# Check if everything is looking good
sudo systemctl status deploy-receiver.service

# Restart the receiver, for example after you make changes
sudo systemctl restart deploy-receiver.service

# Check logs (make sure you scroll to the bottom by pressing SHIFT+G)
journalctl -u deploy-receiver.service

# Follow logs as they happen live
journalctl -f -u deploy-receiver.service
```

