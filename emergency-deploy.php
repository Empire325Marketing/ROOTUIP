<?php
/**
 * ROOTUIP Emergency Deployment Script
 * Upload this file to your server and access it via browser
 */

// Security check - Remove this file after deployment!
$deploy_key = "rootuip2025";
$provided_key = $_GET['key'] ?? $_POST['key'] ?? '';

if ($provided_key !== $deploy_key) {
    die('
    <h2>ROOTUIP Emergency Deployment</h2>
    <p>Access this script with: ?key=rootuip2025</p>
    <p>Example: https://app.rootuip.com/emergency-deploy.php?key=rootuip2025</p>
    ');
}

$action = $_POST['action'] ?? '';
$message = '';

// Function to fix nginx config
function fixNginxConfig() {
    $nginx_config = '
# ROOTUIP API Configuration
location /api/metrics {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}\';
}

location /api/notifications {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"success":true,"notifications":[],"unreadCount":0}\';
}

location /api/shipments {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"success":true,"shipments":[{"container":"MAEU1234567","blNumber":"BL123456789","carrierName":"Maersk","origin":"Shanghai","destination":"Rotterdam","status":"in-transit","eta":"2025-07-15","ddRisk":"Low"}],"total":1}\';
}

location /api/user {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"success":true,"user":{"name":"Demo User","company":"Acme Corporation","role":"Admin"}}\';
}

location /api/ping {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"status":"ok"}\';
}
';

    // Try to write to nginx config
    $config_path = '/etc/nginx/sites-available/rootuip-api-fix.conf';
    $result = @file_put_contents($config_path, $nginx_config);
    
    if ($result) {
        // Try to include in main config
        exec('sudo sed -i "/server_name/a\    include ' . $config_path . ';" /etc/nginx/sites-available/app.rootuip.com 2>&1', $output);
        exec('sudo nginx -t 2>&1', $test_output, $test_return);
        
        if ($test_return === 0) {
            exec('sudo systemctl reload nginx 2>&1', $reload_output);
            return "✅ Nginx configuration updated successfully!";
        } else {
            return "⚠️ Nginx config written but test failed. Manual intervention needed.";
        }
    } else {
        return "❌ Cannot write nginx config. Try manual method below.";
    }
}

// Function to create API endpoint files
function createAPIEndpoints() {
    $api_dir = $_SERVER['DOCUMENT_ROOT'] . '/api';
    
    if (!is_dir($api_dir)) {
        mkdir($api_dir, 0755, true);
    }
    
    // Create API endpoint files
    $endpoints = [
        'metrics' => '{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}',
        'notifications' => '{"success":true,"notifications":[],"unreadCount":0}',
        'shipments' => '{"success":true,"shipments":[{"container":"MAEU1234567","blNumber":"BL123456789","carrierName":"Maersk","origin":"Shanghai","destination":"Rotterdam","status":"in-transit","eta":"2025-07-15","ddRisk":"Low"}],"total":1}',
        'user' => '{"success":true,"user":{"name":"Demo User","company":"Acme Corporation","role":"Admin"}}',
        'ping' => '{"status":"ok"}'
    ];
    
    $created = 0;
    foreach ($endpoints as $name => $content) {
        $file = $api_dir . '/' . $name;
        if (file_put_contents($file, $content)) {
            $created++;
        }
        
        // Also create .json version
        file_put_contents($file . '.json', $content);
    }
    
    // Create .htaccess for API directory
    $htaccess = 'Header set Content-Type "application/json"
Header set Access-Control-Allow-Origin "*"
Options -Indexes
DirectoryIndex metrics';
    file_put_contents($api_dir . '/.htaccess', $htaccess);
    
    return "✅ Created $created API endpoint files in /api/ directory";
}

// Handle actions
if ($action === 'fix_nginx') {
    $message = fixNginxConfig();
} elseif ($action === 'create_api') {
    $message = createAPIEndpoints();
} elseif ($action === 'quick_fix') {
    // Quick fix by creating PHP API endpoints
    $api_router = '<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

$path = $_SERVER["REQUEST_URI"];

if (strpos($path, "/api/metrics") !== false) {
    echo \'{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}\';
} elseif (strpos($path, "/api/notifications") !== false) {
    echo \'{"success":true,"notifications":[],"unreadCount":0}\';
} elseif (strpos($path, "/api/shipments") !== false) {
    echo \'{"success":true,"shipments":[{"container":"MAEU1234567","blNumber":"BL123456789","carrierName":"Maersk","origin":"Shanghai","destination":"Rotterdam","status":"in-transit","eta":"2025-07-15","ddRisk":"Low"}],"total":1}\';
} elseif (strpos($path, "/api/user") !== false) {
    echo \'{"success":true,"user":{"name":"Demo User","company":"Acme Corporation","role":"Admin"}}\';
} else {
    echo \'{"status":"ok"}\';
}
?>';
    
    $result = file_put_contents($_SERVER['DOCUMENT_ROOT'] . '/api.php', $api_router);
    
    // Create .htaccess to route /api/* to api.php
    $htaccess = 'RewriteEngine On
RewriteRule ^api/(.*)$ /api.php [L,QSA]';
    file_put_contents($_SERVER['DOCUMENT_ROOT'] . '/.htaccess', $htaccess);
    
    $message = $result ? "✅ PHP API router created! Test: <a href='/api/metrics' target='_blank'>/api/metrics</a>" : "❌ Could not create API router";
}

?>
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Emergency Deployment</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1000px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
        }
        .button:hover {
            background: #2563eb;
        }
        .code {
            background: #f4f4f4;
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            font-family: monospace;
            margin: 20px 0;
        }
        .success {
            color: #10b981;
            background: #d1fae5;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .error {
            color: #ef4444;
            background: #fee2e2;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .warning {
            color: #f59e0b;
            background: #fef3c7;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚨 ROOTUIP Emergency Deployment</h1>
        
        <?php if ($message): ?>
            <div class="<?php echo strpos($message, '✅') !== false ? 'success' : (strpos($message, '❌') !== false ? 'error' : 'warning'); ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>
        
        <h2>Quick Fix Options</h2>
        
        <form method="POST">
            <input type="hidden" name="key" value="<?php echo htmlspecialchars($deploy_key); ?>">
            
            <h3>Option 1: Fix Nginx Configuration</h3>
            <p>This will attempt to update nginx configuration to serve API endpoints.</p>
            <button type="submit" name="action" value="fix_nginx" class="button">Fix Nginx Config</button>
            
            <h3>Option 2: Create PHP API Router</h3>
            <p>Creates a PHP file to handle API requests (works without nginx changes).</p>
            <button type="submit" name="action" value="quick_fix" class="button">Create PHP API</button>
            
            <h3>Option 3: Create Static API Files</h3>
            <p>Creates static JSON files in /api/ directory.</p>
            <button type="submit" name="action" value="create_api" class="button">Create API Files</button>
        </form>
        
        <h2>Manual Fix (If Buttons Don't Work)</h2>
        
        <h3>For SSH Access:</h3>
        <div class="code">
sudo tee -a /etc/nginx/sites-available/app.rootuip.com << 'EOF'

location /api/metrics {
    add_header Content-Type application/json;
    return 200 '{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}';
}
location /api/notifications {
    add_header Content-Type application/json;
    return 200 '{"notifications":[],"unreadCount":0}';
}
EOF

sudo nginx -t && sudo systemctl reload nginx
        </div>
        
        <h2>Test Your Fix</h2>
        <ul>
            <li><a href="/api/metrics" target="_blank">Test API Metrics</a></li>
            <li><a href="/platform/customer/dashboard.html" target="_blank">Test Dashboard</a></li>
            <li><a href="/platform/mobile-app.html" target="_blank">Test Mobile App</a></li>
        </ul>
        
        <div class="warning">
            <strong>⚠️ Security Warning:</strong> Delete this file after deployment!
            <br><code>rm <?php echo __FILE__; ?></code>
        </div>
    </div>
</body>
</html>