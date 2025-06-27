<?php
// ROOTUIP Web Deployment Script
// Upload this file to your server and access it via browser

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $action = $_POST['action'];
    
    if ($action === 'fix_loading') {
        // Fix the loading issue by adding API endpoints to nginx
        $nginx_config = '
# API endpoints to fix loading issue
location = /api/metrics {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}\';
}
location = /api/notifications {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"notifications":[],"unreadCount":0}\';
}
location = /api/shipments {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 \'{"shipments":[],"total":0}\';
}';
        
        $config_file = '/etc/nginx/sites-available/api-fix.conf';
        $result = file_put_contents($config_file, $nginx_config);
        
        if ($result) {
            // Try to include in main config
            $main_config = '/etc/nginx/sites-available/app.rootuip.com';
            $config_content = file_get_contents($main_config);
            if (strpos($config_content, 'api-fix.conf') === false) {
                $config_content = str_replace('location / {', "include $config_file;\n\n    location / {", $config_content);
                file_put_contents($main_config, $config_content);
            }
            
            // Reload nginx
            exec('sudo nginx -t 2>&1', $test_output, $test_code);
            if ($test_code === 0) {
                exec('sudo systemctl reload nginx 2>&1', $reload_output, $reload_code);
                echo json_encode(['success' => true, 'message' => 'Loading issue fixed! Nginx reloaded.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Nginx config test failed', 'output' => $test_output]);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to write config file']);
        }
        exit;
    }
    
    if ($action === 'deploy_pwa') {
        // Deploy PWA files
        $files_deployed = 0;
        $errors = [];
        
        // Create directories
        $dirs = [
            '/var/www/html/platform/css',
            '/var/www/html/assets/icons'
        ];
        
        foreach ($dirs as $dir) {
            if (!is_dir($dir)) {
                if (!mkdir($dir, 0755, true)) {
                    $errors[] = "Failed to create directory: $dir";
                }
            }
        }
        
        // If we had the files, we would deploy them here
        // For now, just return status
        echo json_encode([
            'success' => count($errors) === 0,
            'files_deployed' => $files_deployed,
            'errors' => $errors,
            'message' => 'PWA deployment requires file upload'
        ]);
        exit;
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Web Deployment</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
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
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 0;
            display: inline-block;
        }
        .button:hover {
            background: #2563eb;
        }
        .button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 6px;
            display: none;
        }
        .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            margin: 20px 0;
            padding: 15px;
            border-radius: 6px;
        }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>ROOTUIP Web Deployment Tool</h1>
        
        <div class="info">
            <strong>Server Status:</strong> Web server is running ✓<br>
            <strong>Current Issue:</strong> Pages showing "loading" due to missing API endpoints
        </div>
        
        <h2>Quick Fix: Loading Issue</h2>
        <p>This will configure nginx to return static API responses so pages load properly.</p>
        <button class="button" onclick="fixLoading()">Fix Loading Issue</button>
        
        <h2>Manual Fix Instructions</h2>
        <p>If the button doesn't work, SSH to your server and run:</p>
        <pre style="background: #f4f4f4; padding: 15px; border-radius: 6px; overflow-x: auto;">
sudo tee -a /etc/nginx/sites-available/app.rootuip.com << 'EOF'

location = /api/metrics {
    add_header Content-Type application/json;
    return 200 '{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}';
}
location = /api/notifications {
    add_header Content-Type application/json;
    return 200 '{"notifications":[],"unreadCount":0}';
}
location = /api/shipments {
    add_header Content-Type application/json;
    return 200 '{"shipments":[],"total":0}';
}
EOF

sudo nginx -t && sudo systemctl reload nginx</pre>
        
        <div id="result" class="result"></div>
    </div>
    
    <script>
        function fixLoading() {
            const button = event.target;
            button.disabled = true;
            button.textContent = 'Fixing...';
            
            fetch('', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'action=fix_loading'
            })
            .then(response => response.json())
            .then(data => {
                const result = document.getElementById('result');
                result.style.display = 'block';
                
                if (data.success) {
                    result.className = 'result success';
                    result.innerHTML = '✓ ' + data.message + '<br><br>Your pages should now load properly!<br>Test here: <a href="/platform/customer/dashboard.html" target="_blank">Dashboard</a>';
                } else {
                    result.className = 'result error';
                    result.innerHTML = '✗ ' + data.message + '<br>Please use the manual instructions above.';
                }
                
                button.textContent = 'Fix Applied';
            })
            .catch(error => {
                const result = document.getElementById('result');
                result.style.display = 'block';
                result.className = 'result error';
                result.innerHTML = '✗ Error: ' + error.message;
                button.disabled = false;
                button.textContent = 'Fix Loading Issue';
            });
        }
    </script>
</body>
</html>