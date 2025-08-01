// Export Presentation Functionality
class PresentationExporter {
    constructor() {
        this.presentation = null;
        this.slides = [];
    }

    init() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Export button in viewer
        const exportBtn = document.querySelector('.export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.showExportModal());
        }

        // Export options in modal
        const exportOptions = document.querySelectorAll('.export-option');
        exportOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const format = e.currentTarget.dataset.format;
                this.exportPresentation(format);
            });
        });

        // Close modal
        const closeModal = document.getElementById('closeExportModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideExportModal());
        }
    }

    showExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async exportPresentation(format) {
        // Gather presentation data
        this.gatherPresentationData();

        switch (format) {
            case 'pdf':
                await this.exportToPDF();
                break;
            case 'pptx':
                await this.exportToPowerPoint();
                break;
            case 'link':
                await this.generateShareLink();
                break;
            default:
                console.error('Unknown export format:', format);
        }

        this.hideExportModal();
    }

    gatherPresentationData() {
        // Collect all slides
        const slideElements = document.querySelectorAll('.slide');
        this.slides = Array.from(slideElements).map((slide, index) => {
            return {
                number: index + 1,
                content: slide.innerHTML,
                notes: slide.dataset.notes || '',
                title: this.extractSlideTitle(slide)
            };
        });

        // Get presentation metadata
        this.presentation = {
            title: document.querySelector('.presentation-title')?.textContent || 'UIP Presentation',
            company: localStorage.getItem('prospectName') || 'Your Company',
            vesselCount: localStorage.getItem('vesselCount') || '50',
            date: new Date().toLocaleDateString(),
            slideCount: this.slides.length
        };
    }

    extractSlideTitle(slideElement) {
        const titleElement = slideElement.querySelector('.slide-title, h1, h2');
        return titleElement ? titleElement.textContent.trim() : `Slide ${slideElement.dataset.slide}`;
    }

    async exportToPDF() {
        // In a real implementation, we'd use a library like jsPDF or html2pdf
        // For now, we'll create a print-friendly version
        
        // Create print stylesheet
        const printStyles = `
            @media print {
                body { background: white; }
                .viewer-topbar,
                .navigation-controls,
                .slide-navigator,
                .presenter-notes { display: none !important; }
                
                .slide {
                    page-break-after: always;
                    position: static !important;
                    opacity: 1 !important;
                    transform: none !important;
                    width: 100% !important;
                    height: 100vh !important;
                    display: flex !important;
                    margin: 0 !important;
                }
                
                .slide-content {
                    max-width: 100% !important;
                    padding: 2rem !important;
                }
                
                /* Add slide numbers */
                .slide::after {
                    content: attr(data-slide);
                    position: fixed;
                    bottom: 1rem;
                    right: 1rem;
                    font-size: 0.875rem;
                    color: #666;
                }
            }
        `;

        // Add print styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = printStyles;
        document.head.appendChild(styleSheet);

        // Trigger print dialog
        window.print();

        // Clean up
        setTimeout(() => {
            document.head.removeChild(styleSheet);
        }, 1000);

        // Show success message
        this.showExportSuccess('PDF export ready. Use your browser\'s print dialog to save as PDF.');
    }

    async exportToPowerPoint() {
        // Create a data structure that could be sent to a server for PPTX generation
        const pptxData = {
            metadata: this.presentation,
            slides: this.slides.map(slide => ({
                number: slide.number,
                title: slide.title,
                content: this.convertHTMLToText(slide.content),
                notes: slide.notes,
                layout: this.detectSlideLayout(slide.content)
            }))
        };

        // In a real implementation, this would send to a server endpoint
        // For now, we'll download as JSON that could be processed
        const dataStr = JSON.stringify(pptxData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.presentation.title.replace(/\s+/g, '-')}-export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showExportSuccess('PowerPoint export data downloaded. Use a converter tool to create PPTX.');
    }

    async generateShareLink() {
        // Generate a shareable link with presentation parameters
        const params = new URLSearchParams({
            presentation: 'master',
            company: this.presentation.company,
            vessels: this.presentation.vesselCount,
            industry: localStorage.getItem('industryType') || 'general'
        });

        const shareUrl = `${window.location.origin}/presentation-deck.html?${params.toString()}`;

        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            this.showExportSuccess('Share link copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            this.showExportSuccess('Share link copied to clipboard!');
        }

        // Also show the link
        this.showShareLink(shareUrl);
    }

    convertHTMLToText(html) {
        // Simple HTML to text conversion
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    detectSlideLayout(content) {
        // Detect the type of slide layout based on content
        if (content.includes('slide-title') && content.includes('chart')) {
            return 'title-chart';
        } else if (content.includes('comparison-table')) {
            return 'comparison';
        } else if (content.includes('timeline')) {
            return 'timeline';
        } else if (content.includes('title-slide')) {
            return 'title';
        } else {
            return 'content';
        }
    }

    showExportSuccess(message) {
        // Create success notification
        const notification = document.createElement('div');
        notification.className = 'export-notification success';
        notification.innerHTML = `
            <div class="notification-content">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        const styles = `
            .export-notification {
                position: fixed;
                bottom: 2rem;
                left: 50%;
                transform: translateX(-50%);
                background: #00D4AA;
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                z-index: 1001;
                animation: slideUp 0.3s ease;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translate(-50%, 20px);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
            }
        `;

        // Add styles if not already present
        if (!document.getElementById('export-notification-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'export-notification-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    showShareLink(url) {
        // Create share link modal
        const shareModal = document.createElement('div');
        shareModal.className = 'share-link-modal';
        shareModal.innerHTML = `
            <div class="share-content">
                <h3>Share This Presentation</h3>
                <p>Send this link to share your customized presentation:</p>
                <div class="share-url-container">
                    <input type="text" value="${url}" readonly class="share-url-input">
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${url}')">
                        Copy
                    </button>
                </div>
                <button class="close-share-modal">Close</button>
            </div>
        `;

        // Add styles
        const styles = `
            .share-link-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 1002;
                max-width: 500px;
                width: 90%;
            }
            
            .share-content h3 {
                margin-bottom: 1rem;
                color: #0A1628;
            }
            
            .share-content p {
                color: #64748B;
                margin-bottom: 1.5rem;
            }
            
            .share-url-container {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 1.5rem;
            }
            
            .share-url-input {
                flex: 1;
                padding: 0.75rem;
                border: 2px solid #E2E8F0;
                border-radius: 6px;
                font-family: 'IBM Plex Mono', monospace;
                font-size: 0.875rem;
            }
            
            .copy-btn {
                padding: 0.75rem 1.5rem;
                background: #00D4AA;
                color: white;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
            }
            
            .close-share-modal {
                width: 100%;
                padding: 0.75rem;
                background: #E2E8F0;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
            }
        `;

        // Add styles if not already present
        if (!document.getElementById('share-modal-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'share-modal-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }

        document.body.appendChild(shareModal);

        // Close button
        shareModal.querySelector('.close-share-modal').addEventListener('click', () => {
            document.body.removeChild(shareModal);
        });
    }
}

// Initialize exporter
document.addEventListener('DOMContentLoaded', () => {
    const exporter = new PresentationExporter();
    exporter.init();
});