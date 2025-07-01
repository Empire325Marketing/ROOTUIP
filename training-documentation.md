# ROOTUIP Customer Training & Documentation

## Table of Contents

1. [Administrator Guide](#administrator-guide)
2. [End User Manual](#end-user-manual)
3. [API Documentation](#api-documentation)
4. [Best Practices](#best-practices)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Support Resources](#support-resources)

---

## Administrator Guide

### System Setup and Configuration

#### Initial System Access
1. **Login Credentials**
   - Access the ROOTUIP platform at `https://app.rootuip.com`
   - Use your provided administrator credentials
   - Enable 2FA for enhanced security

2. **Company Profile Setup**
   ```
   Navigate to: Settings > Company Profile
   - Company Information
   - Billing Details
   - Shipping Lines/Carriers
   - Container Volume Estimates
   ```

3. **User Management**
   - Create user accounts for team members
   - Assign appropriate roles and permissions
   - Set up department-based access controls

#### Carrier API Integration

**Maersk Integration:**
```javascript
// Example API configuration
{
  "carrier": "MAEU",
  "apiEndpoint": "https://api.maersk.com/track",
  "authentication": "OAuth2",
  "credentials": {
    "clientId": "your_client_id",
    "clientSecret": "your_client_secret"
  },
  "refreshInterval": 30000
}
```

**Configuration Steps:**
1. Navigate to Settings > Integrations
2. Select carrier from the list
3. Enter API credentials provided by carrier
4. Test connection
5. Configure sync intervals
6. Enable real-time updates

#### ERP System Integration

**SAP Integration:**
- Module: SAP MM (Materials Management)
- Connection: RFC or Web Services
- Data Sync: Bidirectional for container status

**Oracle Integration:**
- Module: Oracle SCM Cloud
- Connection: REST API
- Authentication: OAuth 2.0

### Data Management

#### Container Data Import
1. **Bulk Import Process**
   - Download CSV template
   - Map required fields:
     - Container Number
     - Booking Reference
     - Origin Port
     - Destination Port
     - Estimated Departure Date
     - Carrier Code

2. **Data Validation Rules**
   ```
   Container Number: 4 letters + 7 digits + check digit
   Port Codes: UN/LOCODE format (5 characters)
   Dates: ISO 8601 format (YYYY-MM-DD)
   Carrier Codes: SCAC format (4 letters)
   ```

#### Automated Data Flows
- **Inbound:** Carrier APIs → ROOTUIP → Your ERP
- **Outbound:** Your ERP → ROOTUIP → Analytics
- **Frequency:** Every 30 seconds for active containers

### Alert Configuration

#### Detention & Demurrage Alerts
```json
{
  "alertTypes": {
    "detention_risk": {
      "threshold": "24_hours_before_free_time_expires",
      "recipients": ["logistics@company.com"],
      "escalation": "manager@company.com"
    },
    "demurrage_risk": {
      "threshold": "48_hours_before_deadline",
      "recipients": ["operations@company.com"],
      "severity": "high"
    }
  }
}
```

#### Custom Business Rules
1. Navigate to Settings > Business Rules
2. Create rule templates:
   - High-value cargo alerts
   - Critical customer shipments
   - Seasonal adjustment rules
   - Port-specific requirements

### Reporting and Analytics

#### Standard Reports
- **Daily Operations Dashboard**
  - Containers in transit
  - Expected arrivals today
  - Detention/demurrage risks
  - Cost savings achieved

- **Weekly Performance Report**
  - On-time delivery metrics
  - Carrier performance comparison
  - Cost avoidance summary
  - Exception handling efficiency

#### Custom Report Builder
1. Access Reports > Custom Reports
2. Select data sources and metrics
3. Configure filters and grouping
4. Schedule automated delivery
5. Export formats: PDF, Excel, CSV

---

## End User Manual

### Getting Started

#### Dashboard Overview
The ROOTUIP dashboard provides real-time visibility into your container operations:

**Key Sections:**
- **Active Containers:** Live tracking of containers in transit
- **Alerts Panel:** Urgent notifications requiring attention
- **Performance Metrics:** KPIs and cost savings data
- **Quick Actions:** Common tasks and shortcuts

#### Navigation Menu
```
├── Dashboard (Overview)
├── Containers
│   ├── Track Container
│   ├── Container List
│   └── Historical Data
├── Alerts
│   ├── Active Alerts
│   ├── Alert History
│   └── Settings
├── Reports
│   ├── Standard Reports
│   ├── Custom Reports
│   └── Scheduled Reports
└── Settings
    ├── Profile
    ├── Notifications
    └── Preferences
```

### Container Tracking

#### Single Container Lookup
1. **Quick Search**
   - Enter container number in search bar
   - View real-time status and location
   - Access detailed timeline and events

2. **Detailed View**
   - Current location and status
   - Estimated time of arrival (ETA)
   - Detention/demurrage timeline
   - Associated documents and contacts

#### Bulk Container Management
1. **Container Lists**
   - Filter by status, carrier, route
   - Sort by priority, ETA, or risk level
   - Export filtered results

2. **Batch Operations**
   - Update multiple containers
   - Assign responsibility
   - Add bulk comments or tags

### Alert Management

#### Understanding Alert Types
- **🔴 Critical:** Immediate action required (detention charges imminent)
- **🟡 Warning:** Attention needed (potential delays detected)
- **🔵 Info:** Status updates (container departure/arrival)

#### Alert Response Workflow
1. **Review Alert Details**
   - Click alert for full context
   - Review suggested actions
   - Check historical patterns

2. **Take Action**
   - Contact carrier/agent
   - Update internal stakeholders
   - Document resolution steps

3. **Mark as Resolved**
   - Add resolution notes
   - Update container status
   - Set follow-up reminders

### Reporting Features

#### Pre-built Reports
- **Executive Summary:** High-level KPIs for management
- **Operational Dashboard:** Daily operations metrics
- **Cost Savings Report:** Detention/demurrage avoidance
- **Carrier Performance:** Comparative analysis

#### Creating Custom Views
1. Navigate to Reports > Custom Reports
2. Select report template or start from scratch
3. Choose data fields and filters
4. Configure visualization preferences
5. Save and share with team

---

## API Documentation

### Authentication

All API requests require authentication using OAuth 2.0:

```bash
curl -X POST https://api.rootuip.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

### Container Tracking API

#### Get Container Status
```bash
GET /api/v1/containers/{container_number}

Response:
{
  "containerNumber": "TCLU1234567",
  "status": "In Transit",
  "location": {
    "port": "Long Beach",
    "coordinates": [33.7701, -118.1937]
  },
  "eta": "2024-02-15T14:30:00Z",
  "alerts": [
    {
      "type": "detention_risk",
      "severity": "medium",
      "message": "Free time expires in 2 days"
    }
  ]
}
```

#### Batch Container Query
```bash
POST /api/v1/containers/batch

Request Body:
{
  "containers": ["TCLU1234567", "MSCU9876543"],
  "includeAlerts": true,
  "includeHistory": false
}
```

### Webhook Integration

#### Setup Webhooks
```bash
POST /api/v1/webhooks

{
  "url": "https://your-system.com/webhook",
  "events": ["container.status_change", "alert.created"],
  "secret": "your_webhook_secret"
}
```

#### Webhook Event Types
- `container.status_change`: Container status updated
- `container.location_update`: GPS position changed
- `alert.created`: New alert generated
- `alert.resolved`: Alert marked as resolved

### Rate Limits
- Standard Plan: 1,000 requests/hour
- Professional Plan: 10,000 requests/hour
- Enterprise Plan: 100,000 requests/hour

---

## Best Practices

### Operational Excellence

#### Daily Monitoring Routine
1. **Morning Review (15 minutes)**
   - Check overnight alerts
   - Review today's expected arrivals
   - Identify potential issues

2. **Midday Check (10 minutes)**
   - Monitor active alerts
   - Verify ETAs for critical shipments
   - Update stakeholders on changes

3. **End-of-Day Summary (10 minutes)**
   - Review day's activities
   - Plan tomorrow's priorities
   - Document lessons learned

#### Proactive Container Management
- **Set up smart alerts** for high-value or time-sensitive cargo
- **Use container grouping** to organize shipments by customer, product, or urgency
- **Leverage predictive analytics** to anticipate delays before they occur
- **Maintain carrier relationships** through data-driven performance discussions

### Data Quality Management

#### Ensuring Accurate Data
1. **Regular Data Audits**
   - Weekly reconciliation with carrier data
   - Monthly ERP system synchronization
   - Quarterly data cleanup procedures

2. **Data Validation Rules**
   ```
   Required Fields: Container #, Booking #, Origin, Destination
   Format Validation: Automated checking of container number formats
   Duplicate Detection: Prevent duplicate container entries
   Cross-Reference: Validate against carrier databases
   ```

#### Integration Best Practices
- **Use standardized data formats** (ISO standards where applicable)
- **Implement error handling** for API failures and data discrepancies
- **Set up monitoring** for integration health and performance
- **Maintain backup procedures** for critical data

### Performance Optimization

#### System Performance
- **Regular maintenance windows** for system updates
- **Monitor API response times** and set up alerts for degradation
- **Optimize database queries** for large container datasets
- **Use caching strategies** for frequently accessed data

#### User Adoption Strategies
1. **Training Programs**
   - Initial onboarding sessions
   - Quarterly refresher training
   - Role-specific deep dives
   - Self-service learning resources

2. **Change Management**
   - Gradual rollout by department
   - Champion network within organization
   - Regular feedback collection
   - Continuous improvement cycles

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Container Not Found
**Symptoms:** Container number search returns no results

**Possible Causes:**
- Incorrect container number format
- Container not yet added to system
- Carrier integration delay

**Solutions:**
1. Verify container number format (4 letters + 7 digits)
2. Check with carrier for container status
3. Manually add container if needed
4. Contact support if integration issue suspected

#### Missing or Delayed Updates
**Symptoms:** Container status not updating in real-time

**Troubleshooting Steps:**
1. Check carrier API status in Settings > Integrations
2. Verify internet connectivity
3. Review API rate limits and quotas
4. Check for system maintenance notifications

#### Alert Not Triggering
**Symptoms:** Expected alerts not appearing

**Diagnostic Process:**
1. Verify alert configuration in Settings > Alerts
2. Check notification preferences
3. Review business rules and thresholds
4. Test with known scenario

#### ERP Integration Issues
**Common Problems:**
- Authentication failures
- Data mapping errors
- Sync delays
- Duplicate records

**Resolution Steps:**
1. Test API credentials
2. Review field mappings
3. Check sync logs for errors
4. Validate data formats

### Performance Issues

#### Slow Dashboard Loading
**Optimization Steps:**
1. Reduce number of containers displayed
2. Adjust refresh intervals
3. Use filters to narrow data scope
4. Clear browser cache

#### API Timeout Errors
**Solutions:**
1. Implement retry logic with exponential backoff
2. Optimize query parameters
3. Use pagination for large datasets
4. Contact support for rate limit increases

### Data Discrepancies

#### Container Status Mismatch
**Investigation Process:**
1. Compare ROOTUIP data with carrier website
2. Check timestamp of last update
3. Review integration logs
4. Verify business rule configurations

#### Incorrect Cost Calculations
**Validation Steps:**
1. Review demurrage/detention rate configurations
2. Check free time allowances
3. Verify currency and timezone settings
4. Compare with manual calculations

---

## Support Resources

### Getting Help

#### 24/7 Support Channels
- **Emergency Hotline:** 1-800-ROOTUIP (Critical issues only)
- **Support Portal:** https://support.rootuip.com
- **Email Support:** support@rootuip.com
- **Live Chat:** Available in application (business hours)

#### Support Tiers
1. **Self-Service**
   - Knowledge base articles
   - Video tutorials
   - Community forums
   - Documentation

2. **Standard Support**
   - Email and chat support
   - Business hours coverage
   - Response time: 4-8 hours

3. **Premium Support**
   - Phone and email support
   - Extended hours coverage
   - Response time: 1-2 hours
   - Dedicated account manager

#### Customer Success Program

**Onboarding Support (First 90 Days):**
- Weekly check-in calls
- Implementation guidance
- Training coordination
- Performance optimization

**Ongoing Success Management:**
- Quarterly business reviews
- Feature update briefings
- Best practice sharing
- ROI measurement and reporting

### Training and Certification

#### Available Training Programs
1. **ROOTUIP Foundations** (2 hours)
   - Platform overview
   - Basic navigation
   - Core features

2. **Advanced User Certification** (4 hours)
   - Advanced features
   - Custom reporting
   - Integration management
   - Best practices

3. **Administrator Certification** (8 hours)
   - System configuration
   - User management
   - API integration
   - Troubleshooting

#### Certification Benefits
- Digital badges for LinkedIn
- Priority support access
- Early access to new features
- Annual certification renewal

### Community and Resources

#### User Community
- **ROOTUIP User Forum:** Share best practices and solutions
- **LinkedIn Group:** Network with other supply chain professionals
- **Quarterly Webinars:** Feature updates and industry insights
- **Annual User Conference:** In-depth training and networking

#### Additional Resources
- **Industry Reports:** Supply chain trends and benchmarks
- **Integration Partners:** Certified technology partners
- **Professional Services:** Custom implementation and consulting
- **API Developer Portal:** Technical documentation and tools

### Feedback and Feature Requests

#### Product Feedback Channels
- **Feature Request Portal:** Vote on and submit new feature ideas
- **Beta Program:** Early access to new features
- **Customer Advisory Board:** Quarterly input on product roadmap
- **User Research Program:** Participate in usability studies

#### Success Metrics and KPIs
ROOTUIP tracks your success through key metrics:
- **Cost Avoidance:** Detention and demurrage charges prevented
- **Operational Efficiency:** Time saved on manual tracking
- **Visibility Improvement:** Percentage of containers with real-time tracking
- **Exception Reduction:** Decrease in supply chain disruptions

---

*This documentation is updated regularly. For the latest version, visit our support portal or contact your Customer Success Manager.*

**Document Version:** 2.1  
**Last Updated:** January 2024  
**Next Review:** April 2024