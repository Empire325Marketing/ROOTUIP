#!/bin/bash

# ROOTUIP Master Deployment Script
# This script orchestrates the complete infrastructure setup

set -e

# Configuration
DOMAIN="rootuip.com"
ADMIN_EMAIL="admin@rootuip.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# ASCII Banner
echo -e "${PURPLE}"
cat << "EOF"
╦═╗ ╔═╗ ╔═╗ ╔╦╗ ╦ ╦ ╦ ╔═╗
╠╦╝ ║ ║ ║ ║  ║  ║ ║ ║ ╠═╝
╩╚═ ╚═╝ ╚═╝  ╩  ╚═╝ ╩ ╩  
Enterprise Infrastructure Deployment
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)
echo -e "${BLUE}Server IP: ${SERVER_IP}${NC}"

# Main menu
echo -e "\n${YELLOW}=== ROOTUIP Deployment Menu ===${NC}"
echo "1. Full Production Setup (Recommended)"
echo "2. Setup Production Environment Only"
echo "3. Setup Staging Environment"
echo "4. Configure Performance Optimization"
echo "5. Setup Monitoring & Alerts"
echo "6. Deploy Application Code"
echo "7. Run Security Hardening"
echo "8. Backup Current Setup"
echo "9. View System Status"
echo "0. Exit"

read -p "Select option: " choice

case $choice in
    1)
        echo -e "\n${YELLOW}Starting full production setup...${NC}"
        
        # Run all setup scripts in order
        echo -e "\n${BLUE}Step 1/5: Setting up production environment${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/setup-production.sh
        
        echo -e "\n${BLUE}Step 2/5: Configuring performance optimization${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/performance-config.sh
        
        echo -e "\n${BLUE}Step 3/5: Setting up monitoring${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/monitoring-setup.sh
        
        echo -e "\n${BLUE}Step 4/5: Creating staging environment${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/staging-environment.sh
        
        echo -e "\n${BLUE}Step 5/5: Finalizing deployment${NC}"
        
        # Fix all paths in HTML files
        echo "Fixing internal links..."
        find /var/www/rootuip/public -name "*.html" -type f -exec sed -i \
            -e 's|href="ROOTUIP/|href="/|g' \
            -e 's|src="ROOTUIP/|src="/|g' \
            -e 's|href="\.\.\/|href="/|g' \
            -e 's|src="\.\.\/|src="/|g' \
            -e 's|\.html"|"|g' {} \;
        
        # Create consolidated structure
        echo "Consolidating file structure..."
        
        # Move all ROOTUIP subdirectory contents to root
        if [ -d "/var/www/rootuip/public/ROOTUIP" ]; then
            cp -r /var/www/rootuip/public/ROOTUIP/* /var/www/rootuip/public/
            rm -rf /var/www/rootuip/public/ROOTUIP
        fi
        
        # Set up SSL
        echo -e "\n${YELLOW}Setting up SSL certificates...${NC}"
        certbot --nginx -d $DOMAIN -d www.$DOMAIN -d staging.$DOMAIN -d app.$DOMAIN \
            --non-interactive --agree-tos -m $ADMIN_EMAIL || \
            echo -e "${YELLOW}SSL setup skipped - domain may not be pointing to this server yet${NC}"
        
        echo -e "\n${GREEN}✓ Full production setup complete!${NC}"
        ;;
        
    2)
        echo -e "\n${YELLOW}Setting up production environment...${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/setup-production.sh
        ;;
        
    3)
        echo -e "\n${YELLOW}Setting up staging environment...${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/staging-environment.sh
        ;;
        
    4)
        echo -e "\n${YELLOW}Configuring performance optimization...${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/performance-config.sh
        ;;
        
    5)
        echo -e "\n${YELLOW}Setting up monitoring...${NC}"
        bash /home/iii/ROOTUIP/infrastructure/deploy/monitoring-setup.sh
        ;;
        
    6)
        echo -e "\n${YELLOW}Deploying application code...${NC}"
        
        # Deploy to production
        echo "Select deployment target:"
        echo "1. Production"
        echo "2. Staging"
        read -p "Choice: " deploy_target
        
        if [ "$deploy_target" = "1" ]; then
            /usr/local/bin/deploy-rootuip.sh production
        else
            /usr/local/bin/deploy-rootuip.sh staging
        fi
        ;;
        
    7)
        echo -e "\n${YELLOW}Running security hardening...${NC}"
        
        # Security hardening
        echo "Configuring firewall..."
        ufw --force enable
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        
        echo "Configuring fail2ban..."
        systemctl enable fail2ban
        systemctl start fail2ban
        
        echo "Setting secure permissions..."
        find /var/www -type d -exec chmod 755 {} \;
        find /var/www -type f -exec chmod 644 {} \;
        chown -R www-data:www-data /var/www
        
        echo "Disabling unnecessary services..."
        systemctl disable bluetooth || true
        systemctl disable cups || true
        
        echo -e "${GREEN}✓ Security hardening complete${NC}"
        ;;
        
    8)
        echo -e "\n${YELLOW}Creating backup...${NC}"
        
        BACKUP_FILE="/var/backups/rootuip-full-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf $BACKUP_FILE \
            /var/www/rootuip \
            /etc/nginx/sites-available \
            /etc/letsencrypt \
            /usr/local/bin/deploy-rootuip.sh \
            /usr/local/bin/rootuip-*.sh \
            2>/dev/null
            
        echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
        ;;
        
    9)
        echo -e "\n${YELLOW}=== System Status ===${NC}"
        
        # Check services
        echo -e "\n${BLUE}Service Status:${NC}"
        systemctl is-active nginx >/dev/null 2>&1 && \
            echo -e "Nginx: ${GREEN}Active${NC}" || echo -e "Nginx: ${RED}Inactive${NC}"
        systemctl is-active redis >/dev/null 2>&1 && \
            echo -e "Redis: ${GREEN}Active${NC}" || echo -e "Redis: ${RED}Inactive${NC}"
        systemctl is-active postgresql >/dev/null 2>&1 && \
            echo -e "PostgreSQL: ${GREEN}Active${NC}" || echo -e "PostgreSQL: ${RED}Inactive${NC}"
        systemctl is-active prometheus >/dev/null 2>&1 && \
            echo -e "Prometheus: ${GREEN}Active${NC}" || echo -e "Prometheus: ${RED}Inactive${NC}"
        systemctl is-active grafana-server >/dev/null 2>&1 && \
            echo -e "Grafana: ${GREEN}Active${NC}" || echo -e "Grafana: ${RED}Inactive${NC}"
        
        # Check websites
        echo -e "\n${BLUE}Website Status:${NC}"
        for site in "https://$DOMAIN" "https://staging.$DOMAIN" "https://app.$DOMAIN"; do
            response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 $site 2>/dev/null || echo "000")
            if [ "$response" = "200" ]; then
                echo -e "$site: ${GREEN}Online ($response)${NC}"
            elif [ "$response" = "401" ]; then
                echo -e "$site: ${YELLOW}Protected ($response)${NC}"
            else
                echo -e "$site: ${RED}Offline ($response)${NC}"
            fi
        done
        
        # System resources
        echo -e "\n${BLUE}System Resources:${NC}"
        echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')%"
        echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
        echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
        
        # Latest deployments
        echo -e "\n${BLUE}Latest Deployments:${NC}"
        ls -lt /var/www/rootuip/public | head -5
        ;;
        
    0)
        echo -e "${YELLOW}Exiting...${NC}"
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Post-deployment checklist
if [ "$choice" = "1" ]; then
    echo -e "\n${YELLOW}=== Post-Deployment Checklist ===${NC}"
    echo -e "${BLUE}DNS Configuration:${NC}"
    echo "1. Point $DOMAIN to $SERVER_IP"
    echo "2. Point www.$DOMAIN to $SERVER_IP"
    echo "3. Point staging.$DOMAIN to $SERVER_IP"
    echo "4. Point app.$DOMAIN to $SERVER_IP"
    
    echo -e "\n${BLUE}SSL Certificates:${NC}"
    echo "Run: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    
    echo -e "\n${BLUE}Access URLs:${NC}"
    echo "Production: https://$DOMAIN"
    echo "Staging: https://staging.$DOMAIN"
    echo "App: https://app.$DOMAIN"
    echo "Monitoring: https://monitoring.$DOMAIN"
    
    echo -e "\n${BLUE}Monitoring:${NC}"
    echo "Grafana: https://monitoring.$DOMAIN (admin/check config)"
    echo "Status: https://$DOMAIN/status"
    
    echo -e "\n${BLUE}Important Files:${NC}"
    echo "Nginx Config: /etc/nginx/sites-available/rootuip.com"
    echo "Deploy Script: /usr/local/bin/deploy-rootuip.sh"
    echo "Logs: /var/log/rootuip/"
    echo "Backups: /var/backups/rootuip/"
    
    echo -e "\n${GREEN}=== Infrastructure Ready for Production! ===${NC}"
fi

# Create quick access script
cat > /usr/local/bin/rootuip << 'EOF'
#!/bin/bash
# ROOTUIP Management Tool

case "$1" in
    deploy)
        /usr/local/bin/deploy-rootuip.sh ${2:-production}
        ;;
    rollback)
        /usr/local/bin/rollback-staging.sh
        ;;
    backup)
        /usr/local/bin/rootuip-backup.sh
        ;;
    monitor)
        /usr/local/bin/rootuip-monitor.sh
        ;;
    logs)
        tail -f /var/log/rootuip/nginx/access.log
        ;;
    status)
        bash /home/iii/ROOTUIP/infrastructure/deploy/DEPLOY-MASTER.sh 9
        ;;
    *)
        echo "Usage: rootuip {deploy|rollback|backup|monitor|logs|status}"
        ;;
esac
EOF

chmod +x /usr/local/bin/rootuip

echo -e "\n${GREEN}Quick access command installed: 'rootuip'${NC}"
echo "Try: rootuip status"