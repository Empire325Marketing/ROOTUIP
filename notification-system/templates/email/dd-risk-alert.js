/**
 * D&D Risk Alert Email Template
 */

module.exports = (data) => {
    const severityColors = {
        critical: '#D32F2F',
        high: '#F57C00',
        medium: '#FBC02D',
        low: '#689F38',
        info: '#0288D1'
    };

    const severityColor = severityColors[data.severity] || '#757575';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>D&D Risk Alert - ${data.severity.toUpperCase()} Risk</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: ${severityColor}; padding: 30px 40px; border-radius: 8px 8px 0 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                                            ⚠️ D&D Risk Alert
                                        </h1>
                                        <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">
                                            ${data.severity.toUpperCase()} RISK DETECTED
                                        </p>
                                    </td>
                                    <td align="right">
                                        <img src="https://rootuip.com/logo-white.png" alt="ROOTUIP" width="120" style="display: block;">
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Alert Summary -->
                    <tr>
                        <td style="padding: 40px 40px 20px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                                <tr>
                                    <td>
                                        <h2 style="margin: 0 0 15px 0; color: #333333; font-size: 20px;">Risk Summary</h2>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #666666;">Entity:</strong>
                                                    <span style="color: #333333;">${data.entityName || data.entityId}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #666666;">Risk Score:</strong>
                                                    <span style="color: ${severityColor}; font-weight: bold;">${data.riskScore}/100</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #666666;">Detection Time:</strong>
                                                    <span style="color: #333333;">${new Date(data.createdAt).toLocaleString()}</span>
                                                </td>
                                            </tr>
                                            ${data.location ? `
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #666666;">Location:</strong>
                                                    <span style="color: #333333;">${data.location}</span>
                                                </td>
                                            </tr>
                                            ` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Risk Details -->
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Risk Factors Identified</h3>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                ${(data.riskFactors || []).map(factor => `
                                    <tr>
                                        <td style="padding: 10px; background-color: #fff3cd; border-left: 4px solid ${severityColor}; margin-bottom: 10px;">
                                            <strong style="color: #856404;">${factor.category}:</strong>
                                            <span style="color: #856404;">${factor.description}</span>
                                            ${factor.score ? `<span style="float: right; color: ${severityColor}; font-weight: bold;">+${factor.score}</span>` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Business Impact -->
                    ${data.businessImpact && data.businessImpact.length > 0 ? `
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Potential Business Impact</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #666666;">
                                ${data.businessImpact.map(impact => `
                                    <li style="padding: 5px 0;">${impact}</li>
                                `).join('')}
                            </ul>
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- Recommended Actions -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Recommended Actions</h3>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 10px 0;">
                                        <a href="${data.assessmentUrl || '#'}" style="display: inline-block; padding: 12px 30px; background-color: ${severityColor}; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                            View Full Risk Assessment
                                        </a>
                                    </td>
                                </tr>
                                ${data.actions && data.actions.length > 0 ? `
                                <tr>
                                    <td style="padding: 20px 0 0 0;">
                                        <p style="margin: 0 0 10px 0; color: #666666;">Additional actions:</p>
                                        <ul style="margin: 0; padding-left: 20px; color: #666666;">
                                            ${data.actions.map(action => `
                                                <li style="padding: 5px 0;">${action}</li>
                                            `).join('')}
                                        </ul>
                                    </td>
                                </tr>
                                ` : ''}
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Related Information -->
                    ${data.correlatedAlerts && data.correlatedAlerts.length > 0 ? `
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #e3f2fd; border-radius: 8px; padding: 20px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0; color: #1976d2;">
                                            <strong>Note:</strong> ${data.correlatedAlerts.length} related alerts have been detected in the same timeframe.
                                            <a href="${data.correlatedAlertsUrl || '#'}" style="color: #1976d2;">View all related alerts →</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 30px 40px; border-radius: 0 0 8px 8px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                                            This is an automated alert from ROOTUIP Risk Management System
                                        </p>
                                        <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                                            Alert ID: ${data.id}
                                        </p>
                                        <p style="margin: 0; color: #999999; font-size: 12px;">
                                            <a href="${data.unsubscribeUrl || '#'}" style="color: #999999;">Manage notification preferences</a>
                                            |
                                            <a href="${data.helpUrl || '#'}" style="color: #999999;">Get help</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
};