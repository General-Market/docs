#!/bin/bash
# Run ONCE interactively to give max passwordless sudo for postgres + systemctl.
# After this, testnet.sh can auto-start postgres without prompts.
#
# Usage: ssh -t index-maker/prod/be 'bash -s' < scripts/fix-vps-sudo.sh

set -e

echo "Adding NOPASSWD sudoers rules for max..."
echo "You'll be prompted for max's sudo password ONE TIME."

sudo tee /etc/sudoers.d/max-services > /dev/null <<'EOF'
# Allow max to manage postgres and systemctl without password
max ALL=(ALL) NOPASSWD: /usr/bin/pg_ctlcluster
max ALL=(ALL) NOPASSWD: /usr/bin/systemctl start postgresql*
max ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop postgresql*
max ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart postgresql*
max ALL=(ALL) NOPASSWD: /usr/bin/systemctl status postgresql*
EOF

sudo chmod 440 /etc/sudoers.d/max-services
sudo visudo -cf /etc/sudoers.d/max-services && echo "Sudoers file valid" || { echo "INVALID — removing"; sudo rm /etc/sudoers.d/max-services; exit 1; }

echo "Done. Testing..."
sudo -n pg_ctlcluster 17 main status 2>&1 || true
echo "max can now manage postgres without password."
