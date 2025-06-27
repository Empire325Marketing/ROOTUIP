#!/bin/bash

# ROOTUIP Image Optimization Tools Installer
# Installs required dependencies for image optimization

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &> /dev/null; then
            OS="ubuntu"
        elif command -v yum &> /dev/null; then
            OS="centos"
        elif command -v dnf &> /dev/null; then
            OS="fedora"
        else
            OS="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        OS="unknown"
    fi
    
    print_status "Detected OS: $OS"
}

# Install dependencies based on OS
install_dependencies() {
    print_header "Installing Image Optimization Dependencies"
    
    case $OS in
        "ubuntu")
            print_status "Installing packages for Ubuntu/Debian..."
            sudo apt-get update
            sudo apt-get install -y webp imagemagick python3 python3-pip
            
            # Install SVGO via npm if available, otherwise skip
            if command -v npm &> /dev/null; then
                sudo npm install -g svgo
            else
                print_warning "npm not available, install Node.js to get SVGO for SVG optimization"
                print_status "You can install Node.js with: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
            fi
            ;;
            
        "centos"|"fedora")
            if [[ "$OS" == "centos" ]]; then
                print_status "Installing packages for CentOS/RHEL..."
                sudo yum install -y libwebp-tools ImageMagick python3 python3-pip
            else
                print_status "Installing packages for Fedora..."
                sudo dnf install -y libwebp-tools ImageMagick python3 python3-pip
            fi
            
            if command -v npm &> /dev/null; then
                sudo npm install -g svgo
            else
                print_warning "npm not available, install Node.js to get SVGO"
            fi
            ;;
            
        "macos")
            print_status "Installing packages for macOS..."
            if command -v brew &> /dev/null; then
                brew install webp imagemagick python3
                brew install node  # This will provide npm
                npm install -g svgo
            else
                print_error "Homebrew not found. Please install Homebrew first:"
                echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
                exit 1
            fi
            ;;
            
        *)
            print_error "Unsupported OS. Please install the following packages manually:"
            echo "  - webp (for WebP conversion)"
            echo "  - imagemagick (for image processing)"
            echo "  - python3 (for HTML processing)"
            echo "  - svgo (for SVG optimization)"
            exit 1
            ;;
    esac
}

# Verify installations
verify_installation() {
    print_header "Verifying Installation"
    
    local deps=("cwebp" "convert" "python3")
    local all_good=true
    
    for dep in "${deps[@]}"; do
        if command -v "$dep" &> /dev/null; then
            print_status "$dep is available"
        else
            print_error "$dep is NOT available"
            all_good=false
        fi
    done
    
    # Check for SVGO
    if command -v svgo &> /dev/null; then
        print_status "svgo is available"
    else
        print_warning "svgo is NOT available (SVG optimization will be skipped)"
    fi
    
    # Check Python version
    if command -v python3 &> /dev/null; then
        python_version=$(python3 --version 2>&1 | cut -d' ' -f2)
        print_status "Python version: $python_version"
    fi
    
    if [ "$all_good" = true ]; then
        print_status "All core dependencies are installed!"
        return 0
    else
        print_error "Missing required dependencies"
        return 1
    fi
}

# Test the tools
test_tools() {
    print_header "Testing Image Tools"
    
    local test_dir="/tmp/image_test_$$"
    mkdir -p "$test_dir"
    
    # Create a test SVG
    cat > "$test_dir/test.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect width="100" height="100" fill="blue"/>
</svg>
EOF
    
    # Test SVGO
    if command -v svgo &> /dev/null; then
        if svgo "$test_dir/test.svg" -o "$test_dir/test_optimized.svg" &>/dev/null; then
            print_status "SVGO test: PASSED"
        else
            print_warning "SVGO test: FAILED"
        fi
    fi
    
    # Create a test PNG using ImageMagick
    if command -v convert &> /dev/null; then
        if convert -size 100x100 xc:red "$test_dir/test.png" &>/dev/null; then
            print_status "ImageMagick test: PASSED"
            
            # Test WebP conversion
            if command -v cwebp &> /dev/null; then
                if cwebp -q 80 "$test_dir/test.png" -o "$test_dir/test.webp" &>/dev/null; then
                    print_status "WebP conversion test: PASSED"
                else
                    print_warning "WebP conversion test: FAILED"
                fi
            fi
        else
            print_warning "ImageMagick test: FAILED"
        fi
    fi
    
    # Cleanup
    rm -rf "$test_dir"
}

# Main installation process
main() {
    print_header "ROOTUIP Image Optimization Tools Installer"
    
    detect_os
    install_dependencies
    
    if verify_installation; then
        test_tools
        
        print_header "Installation Complete"
        print_status "You can now run the image optimization script:"
        echo "  ./optimize-images.sh"
        echo ""
        print_status "To update HTML files with optimized image references:"
        echo "  python3 update-html-images.py"
        echo ""
        print_status "For more information, see the generated reports after running the scripts."
        
    else
        print_error "Installation failed. Please check the error messages above."
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi