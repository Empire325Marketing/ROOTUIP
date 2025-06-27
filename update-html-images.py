#!/usr/bin/env python3
"""
ROOTUIP HTML Image Reference Updater
Updates HTML files to use optimized images with proper fallbacks
"""

import os
import re
import glob
import shutil
from pathlib import Path

class HTMLImageUpdater:
    def __init__(self, rootuip_dir="/home/iii/ROOTUIP/ROOTUIP"):
        self.rootuip_dir = Path(rootuip_dir)
        self.backup_dir = self.rootuip_dir / "backups" / "html"
        self.updated_files = []
        
    def setup_backup_dir(self):
        """Create backup directory for HTML files"""
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        print(f"✓ Backup directory created: {self.backup_dir}")
    
    def find_html_files(self):
        """Find all HTML files in the ROOTUIP directory"""
        html_files = []
        for pattern in ["**/*.html", "**/*.htm"]:
            html_files.extend(self.rootuip_dir.glob(pattern))
        
        print(f"✓ Found {len(html_files)} HTML files")
        return html_files
    
    def backup_file(self, file_path):
        """Create backup of HTML file"""
        backup_path = self.backup_dir / file_path.name
        counter = 1
        while backup_path.exists():
            stem = file_path.stem
            suffix = file_path.suffix
            backup_path = self.backup_dir / f"{stem}.backup{counter}{suffix}"
            counter += 1
        
        shutil.copy2(file_path, backup_path)
        return backup_path
    
    def update_favicon_references(self, content):
        """Update favicon references to use optimized SVG"""
        patterns = [
            # Update favicon href to use brand directory
            (r'href="/?favicon\.svg"', 'href="/ROOTUIP/brand/favicon.svg"'),
            (r'href="/?brand/brand/favicon\.svg"', 'href="/ROOTUIP/brand/favicon.svg"'),
            
            # Update icon references
            (r'href="/?brand/brand/logo-icon-new\.svg"', 'href="/ROOTUIP/brand/logo-icon-new.svg"'),
            
            # Ensure proper MIME type for SVG favicons
            (r'<link rel="icon"([^>]*?)href="([^"]*\.svg)"([^>]*?)>', 
             r'<link rel="icon" type="image/svg+xml"\1href="\2"\3>'),
        ]
        
        updated = False
        for pattern, replacement in patterns:
            new_content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
            if new_content != content:
                updated = True
                content = new_content
        
        return content, updated
    
    def update_image_references(self, content):
        """Update img tags to use WebP with fallbacks"""
        img_pattern = r'<img([^>]*?)src="([^"]*\.(png|jpe?g))"([^>]*?)>'
        
        def replace_img(match):
            before_src = match.group(1)
            img_src = match.group(2)
            ext = match.group(3)
            after_src = match.group(4)
            
            # Create WebP version path
            webp_src = re.sub(r'\.(png|jpe?g)$', '.webp', img_src, flags=re.IGNORECASE)
            
            # Extract attributes
            alt_match = re.search(r'alt="([^"]*)"', before_src + after_src)
            alt_text = alt_match.group(1) if alt_match else ""
            
            class_match = re.search(r'class="([^"]*)"', before_src + after_src)
            css_class = f' class="{class_match.group(1)}"' if class_match else ""
            
            loading_match = re.search(r'loading="([^"]*)"', before_src + after_src)
            loading_attr = f' loading="{loading_match.group(1)}"' if loading_match else ' loading="lazy"'
            
            # Get any other attributes
            other_attrs = re.sub(r'(src|alt|class|loading)="[^"]*"\s*', '', before_src + after_src).strip()
            other_attrs = f' {other_attrs}' if other_attrs else ''
            
            # Create picture element with WebP and fallback
            return f'''<picture>
    <source srcset="{webp_src}" type="image/webp">
    <img src="{img_src}" alt="{alt_text}"{css_class}{loading_attr}{other_attrs}>
</picture>'''
        
        new_content = re.sub(img_pattern, replace_img, content, flags=re.IGNORECASE)
        return new_content, new_content != content
    
    def update_css_background_images(self, content):
        """Update CSS background-image properties to use WebP"""
        bg_pattern = r'background-image:\s*url\(["\']?([^"\']*\.(png|jpe?g))["\']?\)'
        
        def replace_bg(match):
            img_src = match.group(1)
            webp_src = re.sub(r'\.(png|jpe?g)$', '.webp', img_src, flags=re.IGNORECASE)
            
            return f'''background-image: url('{webp_src}');
    background-image: -webkit-image-set(
        url('{webp_src}') type('image/webp'),
        url('{img_src}') type('image/{match.group(2)}')
    );
    background-image: image-set(
        url('{webp_src}') type('image/webp'),
        url('{img_src}') type('image/{match.group(2)}')
    )'''
        
        new_content = re.sub(bg_pattern, replace_bg, content, flags=re.IGNORECASE)
        return new_content, new_content != content
    
    def add_webp_detection_script(self, content):
        """Add WebP detection script if not already present"""
        if 'webp-detection.js' in content:
            return content, False
        
        # Find the closing </head> tag
        head_pattern = r'(</head>)'
        script_tag = '''    <script src="/ROOTUIP/js/webp-detection.js"></script>
    <link rel="stylesheet" href="/ROOTUIP/css/image-optimization.css">
</head>'''
        
        new_content = re.sub(head_pattern, script_tag, content, flags=re.IGNORECASE)
        return new_content, new_content != content
    
    def optimize_logo_references(self, content):
        """Optimize logo references for performance"""
        logo_patterns = [
            # Update logo paths to use proper brand directory
            (r'src="/?brand/logo-horizontal\.svg"', 'src="/ROOTUIP/brand/logo-horizontal.svg"'),
            (r'src="/?brand/brand/logo-icon-new\.svg"', 'src="/ROOTUIP/brand/logo-icon-new.svg"'),
            (r'src="/?brand/logo\.svg"', 'src="/ROOTUIP/brand/logo.svg"'),
            
            # Add proper sizing attributes for logos
            (r'(<img[^>]*?src="[^"]*brand/logo[^"]*\.svg"[^>]*?)>', 
             r'\1 width="auto" height="40" loading="eager" importance="high">'),
        ]
        
        updated = False
        for pattern, replacement in logo_patterns:
            new_content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
            if new_content != content:
                updated = True
                content = new_content
        
        return content, updated
    
    def process_html_file(self, file_path):
        """Process a single HTML file"""
        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            file_updated = False
            
            # Apply all updates
            updates = [
                self.update_favicon_references,
                self.update_image_references,
                self.update_css_background_images,
                self.add_webp_detection_script,
                self.optimize_logo_references
            ]
            
            for update_func in updates:
                content, updated = update_func(content)
                if updated:
                    file_updated = True
            
            # Write updated content if changes were made
            if file_updated:
                # Create backup first
                backup_path = self.backup_file(file_path)
                
                # Write updated content
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                self.updated_files.append({
                    'file': file_path,
                    'backup': backup_path,
                    'changes': 'Image optimization updates applied'
                })
                
                print(f"✓ Updated: {file_path.relative_to(self.rootuip_dir)}")
                return True
            else:
                print(f"• No changes: {file_path.relative_to(self.rootuip_dir)}")
                return False
                
        except Exception as e:
            print(f"✗ Error processing {file_path}: {e}")
            return False
    
    def generate_update_report(self):
        """Generate a report of all updates made"""
        report_path = self.rootuip_dir / "html-update-report.html"
        
        with open(report_path, 'w') as f:
            f.write(f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Image Update Report</title>
    <style>
        body {{ font-family: system-ui, -apple-system, sans-serif; margin: 2rem; }}
        .header {{ background: #1e40af; color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }}
        .stat {{ background: #f8fafc; padding: 1.5rem; border-radius: 8px; text-align: center; }}
        .stat-number {{ font-size: 2rem; font-weight: bold; color: #1e40af; }}
        .file-list {{ background: white; border: 1px solid #e2e8f0; border-radius: 8px; }}
        .file-item {{ padding: 1rem; border-bottom: 1px solid #f1f5f9; }}
        .file-item:last-child {{ border-bottom: none; }}
        .success {{ color: #059669; }}
        .info {{ color: #0284c7; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>HTML Image Update Report</h1>
        <p>Generated on {os.popen('date').read().strip()}</p>
    </div>
    
    <div class="summary">
        <div class="stat">
            <div class="stat-number">{len(self.updated_files)}</div>
            <div>Files Updated</div>
        </div>
        <div class="stat">
            <div class="stat-number">{len(list(self.backup_dir.glob('*'))) if self.backup_dir.exists() else 0}</div>
            <div>Backups Created</div>
        </div>
    </div>
    
    <h2>Updated Files</h2>
    <div class="file-list">
""")
            
            for update in self.updated_files:
                rel_path = update['file'].relative_to(self.rootuip_dir)
                f.write(f"""        <div class="file-item">
            <strong>{rel_path}</strong>
            <div class="info">{update['changes']}</div>
            <small>Backup: {update['backup'].name}</small>
        </div>
""")
            
            f.write("""    </div>
    
    <h2>Updates Applied</h2>
    <ul>
        <li><strong>Image References:</strong> Updated img tags to use WebP with fallbacks</li>
        <li><strong>Favicon Optimization:</strong> Corrected favicon paths and MIME types</li>
        <li><strong>Logo Performance:</strong> Added proper sizing and loading attributes</li>
        <li><strong>CSS Background Images:</strong> Updated to use WebP with fallbacks</li>
        <li><strong>WebP Detection:</strong> Added JavaScript for browser support detection</li>
        <li><strong>Lazy Loading:</strong> Applied to non-critical images</li>
    </ul>
    
</body>
</html>""")
        
        print(f"✓ Report generated: {report_path}")
    
    def run(self):
        """Run the HTML update process"""
        print("🚀 Starting HTML Image Reference Update")
        print("=" * 50)
        
        # Setup
        self.setup_backup_dir()
        
        # Find and process HTML files
        html_files = self.find_html_files()
        
        updated_count = 0
        for html_file in html_files:
            if self.process_html_file(html_file):
                updated_count += 1
        
        # Generate report
        self.generate_update_report()
        
        print("=" * 50)
        print(f"✅ HTML Update Complete!")
        print(f"   Files processed: {len(html_files)}")
        print(f"   Files updated: {updated_count}")
        print(f"   Backups created in: {self.backup_dir}")

if __name__ == "__main__":
    updater = HTMLImageUpdater()
    updater.run()