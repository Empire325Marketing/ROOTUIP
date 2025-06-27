# Google Analytics Implementation Guide

## Setup Complete
Google Analytics has been added to all HTML files in the project.

## Configuration Steps

1. **Get your GA4 Measurement ID**:
   - Go to Google Analytics
   - Admin → Data Streams → Web
   - Copy your Measurement ID (starts with G-)

2. **Update the ID**:
   - Run: `./add-analytics.sh G-YOUR-ACTUAL-ID`
   - Or manually replace G-XXXXXXXXXX in all files

3. **Verify Installation**:
   - Use Google Analytics Debugger Chrome extension
   - Check Real-time reports in GA4
   - Use Tag Assistant

## Custom Events Implemented

- **User Authentication**: Login methods, MFA usage
- **Shipment Tracking**: Search queries, results
- **Document Management**: Uploads, verifications
- **API Usage**: Endpoint calls, response times
- **Feature Engagement**: Feature usage patterns
- **Performance Metrics**: Page load times, errors

## Recommended GA4 Configuration

1. **Create Custom Dimensions**:
   - user_type (User/Admin/Operator)
   - company_id
   - shipment_count
   - integration_status

2. **Set up Conversions**:
   - Trial signups
   - Feature adoption
   - API key generation
   - Document uploads

3. **Configure Audiences**:
   - Active users (daily shipment checks)
   - Power users (API usage)
   - At-risk users (declining usage)

4. **Create Custom Reports**:
   - Feature adoption funnel
   - API usage by endpoint
   - Document processing metrics
   - User engagement by company size
