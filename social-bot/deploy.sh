#!/bin/bash
set -e

VPS="index-maker/prod/be"
REMOTE_DIR="/home/max/social-bot"

echo "Syncing social-bot to VPS..."
rsync -avz --exclude='.env' --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='.twitter-creds.json' --exclude='scheduled.csv' \
    --exclude='poster.py' --exclude='directives/' \
    social-bot/ "$VPS:$REMOTE_DIR/"

echo "Installing dependencies..."
ssh "$VPS" "cd $REMOTE_DIR && pip install -r requirements.txt"

echo "Running migrations..."
ssh "$VPS" "cd $REMOTE_DIR && python migrate.py"

echo "Done. Start with: ssh $VPS 'cd $REMOTE_DIR && python server.py'"
