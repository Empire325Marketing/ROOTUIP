/**
 * ROOTUIP Team Collaboration Manager
 * Real-time collaboration features for team workflows
 */

const EventEmitter = require('events');

class TeamCollaborationManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableRealTimeCollaboration: config.enableRealTimeCollaboration !== false,
            enableComments: config.enableComments !== false,
            enableMentions: config.enableMentions !== false,
            enableSharedWorkspaces: config.enableSharedWorkspaces !== false,
            enableActivityFeed: config.enableActivityFeed !== false,
            enableNotifications: config.enableNotifications !== false,
            maxCommentLength: config.maxCommentLength || 1000,
            mentionTrigger: config.mentionTrigger || '@',
            websocketUrl: config.websocketUrl || 'ws://localhost:3012'
        };
        
        // Current user info
        this.currentUser = {
            id: null,
            name: null,
            avatar: null,
            role: null,
            isOnline: false
        };
        
        // Active users in current workspace
        this.activeUsers = new Map();
        
        // Comments and annotations
        this.comments = new Map();
        this.annotations = new Map();
        
        // Shared workspaces
        this.workspaces = new Map();
        
        // Activity feed
        this.activities = [];
        
        // Notifications
        this.notifications = [];
        
        // Real-time cursors and selections
        this.cursors = new Map();
        this.selections = new Map();
        
        // Team members and roles
        this.teamMembers = new Map();
        this.roles = new Map();
        
        // Collaboration tools
        this.collaborationTools = new Map();
        
        // WebSocket connection
        this.websocket = null;
        
        // Initialize collaboration features
        this.initializeCollaboration();
        this.setupEventListeners();
    }
    
    // Initialize collaboration system
    initializeCollaboration() {
        if (typeof document === 'undefined') return;
        
        // Setup WebSocket connection
        this.setupWebSocketConnection();
        
        // Initialize UI components
        this.createCollaborationUI();
        
        // Setup real-time features
        this.setupRealTimeFeatures();
        
        // Initialize roles and permissions
        this.initializeRoles();
        
        // Setup notification system
        this.setupNotificationSystem();
        
        // Load workspace data
        this.loadWorkspaceData();
    }
    
    // Setup WebSocket connection
    setupWebSocketConnection() {
        if (!this.config.enableRealTimeCollaboration) return;
        
        try {
            this.websocket = new WebSocket(this.config.websocketUrl);
            
            this.websocket.onopen = () => {
                console.log('Collaboration WebSocket connected');
                this.emit('collaboration:connected');
                
                // Join current workspace
                if (this.currentWorkspace) {
                    this.joinWorkspace(this.currentWorkspace);
                }
            };
            
            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };
            
            this.websocket.onclose = () => {
                console.log('Collaboration WebSocket disconnected');
                this.emit('collaboration:disconnected');
                
                // Attempt to reconnect
                setTimeout(() => {
                    this.setupWebSocketConnection();
                }, 5000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('Collaboration WebSocket error:', error);
                this.emit('collaboration:error', error);
            };
            
        } catch (error) {
            console.error('Failed to establish WebSocket connection:', error);
        }
    }
    
    // Handle WebSocket messages
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'user_joined':
                this.handleUserJoined(message.data);
                break;
                
            case 'user_left':
                this.handleUserLeft(message.data);
                break;
                
            case 'cursor_update':
                this.handleCursorUpdate(message.data);
                break;
                
            case 'selection_update':
                this.handleSelectionUpdate(message.data);
                break;
                
            case 'comment_added':
                this.handleCommentAdded(message.data);
                break;
                
            case 'comment_updated':
                this.handleCommentUpdated(message.data);
                break;
                
            case 'activity_update':
                this.handleActivityUpdate(message.data);
                break;
                
            case 'notification':
                this.handleNotification(message.data);
                break;
                
            case 'workspace_update':
                this.handleWorkspaceUpdate(message.data);
                break;
        }
    }
    
    // Create collaboration UI
    createCollaborationUI() {
        // Create collaboration toolbar
        this.createCollaborationToolbar();
        
        // Create comments panel
        this.createCommentsPanel();
        
        // Create activity feed
        this.createActivityFeed();
        
        // Create user presence indicators
        this.createUserPresenceIndicators();
        
        // Create notification center
        this.createNotificationCenter();
        
        // Create mention dropdown
        this.createMentionDropdown();
    }
    
    // Create collaboration toolbar
    createCollaborationToolbar() {
        const toolbar = document.createElement('div');
        toolbar.id = 'collaboration-toolbar';
        toolbar.className = 'collaboration-toolbar';
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <button class="toolbar-btn" id="share-workspace-btn" title="Share Workspace">
                    🔗 Share
                </button>
                <button class="toolbar-btn" id="comments-btn" title="Toggle Comments">
                    💬 Comments
                </button>
                <button class="toolbar-btn" id="activity-feed-btn" title="Activity Feed">
                    📋 Activity
                </button>
            </div>
            
            <div class="toolbar-section">
                <div class="active-users">
                    <span class="users-label">Online:</span>
                    <div class="user-avatars" id="user-avatars">
                        <!-- User avatars will be populated here -->
                    </div>
                </div>
            </div>
            
            <div class="toolbar-section">
                <button class="toolbar-btn" id="notifications-btn" title="Notifications">
                    🔔 <span class="notification-count" id="notification-count">0</span>
                </button>
            </div>
        `;
        
        // Add event listeners
        this.setupToolbarEvents(toolbar);
        
        document.body.appendChild(toolbar);
    }
    
    // Setup toolbar events
    setupToolbarEvents(toolbar) {
        toolbar.querySelector('#share-workspace-btn').addEventListener('click', () => {
            this.showShareWorkspaceDialog();
        });
        
        toolbar.querySelector('#comments-btn').addEventListener('click', () => {
            this.toggleCommentsPanel();
        });
        
        toolbar.querySelector('#activity-feed-btn').addEventListener('click', () => {
            this.toggleActivityFeed();
        });
        
        toolbar.querySelector('#notifications-btn').addEventListener('click', () => {
            this.toggleNotificationCenter();
        });
    }
    
    // Create comments panel
    createCommentsPanel() {
        const panel = document.createElement('div');
        panel.id = 'comments-panel';
        panel.className = 'collaboration-panel comments-panel hidden';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Comments</h3>
                <button class="panel-close">×</button>
            </div>
            
            <div class="panel-content">
                <div class="comments-list" id="comments-list">
                    <!-- Comments will be populated here -->
                </div>
                
                <div class="comment-composer">
                    <textarea 
                        id="comment-input" 
                        placeholder="Add a comment... Use @ to mention team members"
                        rows="3"
                    ></textarea>
                    <div class="composer-actions">
                        <button class="btn-secondary" id="cancel-comment">Cancel</button>
                        <button class="btn-primary" id="submit-comment">Comment</button>
                    </div>
                </div>
            </div>
        `;
        
        this.setupCommentsPanelEvents(panel);
        document.body.appendChild(panel);
    }
    
    // Setup comments panel events
    setupCommentsPanelEvents(panel) {
        const commentInput = panel.querySelector('#comment-input');
        const submitBtn = panel.querySelector('#submit-comment');
        const cancelBtn = panel.querySelector('#cancel-comment');
        const closeBtn = panel.querySelector('.panel-close');
        
        // Handle comment submission
        submitBtn.addEventListener('click', () => {
            const content = commentInput.value.trim();
            if (content) {
                this.addComment(content);
                commentInput.value = '';
            }
        });
        
        // Handle Enter key (with Shift+Enter for new line)
        commentInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitBtn.click();
            }
        });
        
        // Handle mentions
        commentInput.addEventListener('input', (event) => {
            this.handleMentionInput(event);
        });
        
        cancelBtn.addEventListener('click', () => {
            commentInput.value = '';
        });
        
        closeBtn.addEventListener('click', () => {
            this.hideCommentsPanel();
        });
    }
    
    // Create activity feed
    createActivityFeed() {
        const feed = document.createElement('div');
        feed.id = 'activity-feed';
        feed.className = 'collaboration-panel activity-feed hidden';
        feed.innerHTML = `
            <div class="panel-header">
                <h3>Team Activity</h3>
                <button class="panel-close">×</button>
            </div>
            
            <div class="panel-content">
                <div class="activity-filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="comments">Comments</button>
                    <button class="filter-btn" data-filter="edits">Edits</button>
                    <button class="filter-btn" data-filter="shares">Shares</button>
                </div>
                
                <div class="activity-list" id="activity-list">
                    <!-- Activity items will be populated here -->
                </div>
            </div>
        `;
        
        this.setupActivityFeedEvents(feed);
        document.body.appendChild(feed);
    }
    
    // Setup activity feed events
    setupActivityFeedEvents(feed) {
        const closeBtn = feed.querySelector('.panel-close');
        const filterBtns = feed.querySelectorAll('.filter-btn');
        
        closeBtn.addEventListener('click', () => {
            this.hideActivityFeed();
        });
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterActivities(btn.dataset.filter);
            });
        });
    }
    
    // Create user presence indicators
    createUserPresenceIndicators() {
        // Create styles for user cursors and selections
        const style = document.createElement('style');
        style.id = 'collaboration-presence-styles';
        style.textContent = `
            .user-cursor {
                position: absolute;
                width: 2px;
                height: 20px;
                background: var(--user-color);
                pointer-events: none;
                z-index: 1000;
                transition: all 0.1s ease;
            }
            
            .user-cursor::after {
                content: attr(data-user-name);
                position: absolute;
                top: -25px;
                left: 0;
                background: var(--user-color);
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 12px;
                white-space: nowrap;
                font-weight: 500;
            }
            
            .user-selection {
                background: var(--user-color);
                opacity: 0.3;
                pointer-events: none;
                position: absolute;
                z-index: 999;
            }
            
            .user-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 2px solid var(--user-color, #00d4ff);
                margin-left: -8px;
                position: relative;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .user-avatar:hover {
                transform: scale(1.1);
                z-index: 10;
            }
            
            .user-avatar.online::after {
                content: '';
                position: absolute;
                bottom: 0;
                right: 0;
                width: 10px;
                height: 10px;
                background: #00ff00;
                border: 2px solid white;
                border-radius: 50%;
            }
            
            .collaboration-toolbar {
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(26, 31, 53, 0.95);
                border-radius: 12px;
                padding: 12px;
                border: 1px solid rgba(42, 63, 95, 0.5);
                backdrop-filter: blur(10px);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            
            .toolbar-section {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .toolbar-btn {
                background: rgba(0, 212, 255, 0.1);
                border: 1px solid rgba(0, 212, 255, 0.3);
                color: #00d4ff;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                position: relative;
            }
            
            .toolbar-btn:hover {
                background: rgba(0, 212, 255, 0.2);
                border-color: rgba(0, 212, 255, 0.5);
            }
            
            .notification-count {
                background: #ff3838;
                color: white;
                border-radius: 50%;
                padding: 2px 6px;
                font-size: 12px;
                margin-left: 4px;
            }
            
            .collaboration-panel {
                position: fixed;
                top: 140px;
                right: 20px;
                width: 350px;
                max-height: 60vh;
                background: rgba(26, 31, 53, 0.95);
                border-radius: 12px;
                border: 1px solid rgba(42, 63, 95, 0.5);
                backdrop-filter: blur(10px);
                z-index: 1001;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
            }
            
            .collaboration-panel.hidden {
                opacity: 0;
                transform: translateX(100%);
                pointer-events: none;
            }
            
            .panel-header {
                padding: 15px;
                border-bottom: 1px solid rgba(42, 63, 95, 0.5);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .panel-header h3 {
                margin: 0;
                color: #ffffff;
                font-size: 16px;
            }
            
            .panel-close {
                background: none;
                border: none;
                color: #a0a0a0;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .panel-content {
                padding: 15px;
                max-height: calc(60vh - 60px);
                overflow-y: auto;
            }
            
            .comment-item {
                background: rgba(15, 20, 32, 0.6);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid rgba(42, 63, 95, 0.3);
            }
            
            .comment-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .comment-author {
                font-weight: 600;
                color: #00d4ff;
                font-size: 14px;
            }
            
            .comment-time {
                font-size: 12px;
                color: #a0a0a0;
            }
            
            .comment-content {
                color: #e0e0e0;
                line-height: 1.4;
            }
            
            .comment-composer {
                margin-top: 15px;
                border-top: 1px solid rgba(42, 63, 95, 0.3);
                padding-top: 15px;
            }
            
            .comment-composer textarea {
                width: 100%;
                background: rgba(15, 20, 32, 0.6);
                border: 1px solid rgba(42, 63, 95, 0.5);
                border-radius: 6px;
                padding: 10px;
                color: #e0e0e0;
                resize: vertical;
                font-family: inherit;
            }
            
            .composer-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 8px;
            }
            
            .activity-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 0;
                border-bottom: 1px solid rgba(42, 63, 95, 0.2);
            }
            
            .activity-item:last-child {
                border-bottom: none;
            }
            
            .activity-icon {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: rgba(0, 212, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                flex-shrink: 0;
            }
            
            .activity-content {
                flex: 1;
            }
            
            .activity-text {
                color: #e0e0e0;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .activity-time {
                color: #a0a0a0;
                font-size: 12px;
                margin-top: 2px;
            }
            
            .mention {
                background: rgba(0, 212, 255, 0.2);
                color: #00d4ff;
                padding: 2px 4px;
                border-radius: 3px;
                font-weight: 500;
            }
            
            .mention-dropdown {
                position: absolute;
                background: rgba(26, 31, 53, 0.95);
                border: 1px solid rgba(42, 63, 95, 0.5);
                border-radius: 6px;
                backdrop-filter: blur(10px);
                z-index: 10000;
                max-height: 200px;
                overflow-y: auto;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            }
            
            .mention-option {
                padding: 8px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                color: #e0e0e0;
                transition: background-color 0.2s ease;
            }
            
            .mention-option:hover,
            .mention-option.selected {
                background: rgba(0, 212, 255, 0.2);
            }
            
            .mention-avatar {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #00d4ff;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Create notification center
    createNotificationCenter() {
        const center = document.createElement('div');
        center.id = 'notification-center';
        center.className = 'collaboration-panel notification-center hidden';
        center.innerHTML = `
            <div class="panel-header">
                <h3>Notifications</h3>
                <div class="header-actions">
                    <button class="btn-text" id="mark-all-read">Mark all read</button>
                    <button class="panel-close">×</button>
                </div>
            </div>
            
            <div class="panel-content">
                <div class="notification-list" id="notification-list">
                    <!-- Notifications will be populated here -->
                </div>
            </div>
        `;
        
        this.setupNotificationCenterEvents(center);
        document.body.appendChild(center);
    }
    
    // Setup notification center events
    setupNotificationCenterEvents(center) {
        const closeBtn = center.querySelector('.panel-close');
        const markAllReadBtn = center.querySelector('#mark-all-read');
        
        closeBtn.addEventListener('click', () => {
            this.hideNotificationCenter();
        });
        
        markAllReadBtn.addEventListener('click', () => {
            this.markAllNotificationsRead();
        });
    }
    
    // Create mention dropdown
    createMentionDropdown() {
        const dropdown = document.createElement('div');
        dropdown.id = 'mention-dropdown';
        dropdown.className = 'mention-dropdown hidden';
        
        document.body.appendChild(dropdown);
    }
    
    // Setup real-time features
    setupRealTimeFeatures() {
        if (!this.config.enableRealTimeCollaboration) return;
        
        // Track cursor movements
        this.setupCursorTracking();
        
        // Track text selections
        this.setupSelectionTracking();
        
        // Setup collaborative editing
        this.setupCollaborativeEditing();
    }
    
    // Setup cursor tracking
    setupCursorTracking() {
        let cursorTimeout;
        
        document.addEventListener('mousemove', (event) => {
            clearTimeout(cursorTimeout);
            cursorTimeout = setTimeout(() => {
                this.broadcastCursorPosition(event.clientX, event.clientY);
            }, 50);
        });
        
        document.addEventListener('mouseleave', () => {
            this.broadcastCursorPosition(null, null);
        });
    }
    
    // Setup selection tracking
    setupSelectionTracking() {
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                this.broadcastSelection(range);
            }
        });
    }
    
    // Setup collaborative editing
    setupCollaborativeEditing() {
        // Track changes in contentEditable elements
        const editableElements = document.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]');
        
        editableElements.forEach(element => {
            element.addEventListener('input', (event) => {
                this.handleContentChange(element, event);
            });
        });
    }
    
    // Initialize roles and permissions
    initializeRoles() {
        // Define standard roles
        this.roles.set('owner', {
            name: 'Owner',
            permissions: ['read', 'write', 'delete', 'share', 'admin', 'invite', 'manage_roles']
        });
        
        this.roles.set('admin', {
            name: 'Admin',
            permissions: ['read', 'write', 'delete', 'share', 'invite', 'manage_roles']
        });
        
        this.roles.set('editor', {
            name: 'Editor',
            permissions: ['read', 'write', 'share', 'comment']
        });
        
        this.roles.set('collaborator', {
            name: 'Collaborator',
            permissions: ['read', 'write', 'comment']
        });
        
        this.roles.set('commenter', {
            name: 'Commenter',
            permissions: ['read', 'comment']
        });
        
        this.roles.set('viewer', {
            name: 'Viewer',
            permissions: ['read']
        });
    }
    
    // Setup notification system
    setupNotificationSystem() {
        if (!this.config.enableNotifications) return;
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    // Load workspace data
    loadWorkspaceData() {
        // Load from localStorage for now (in production, load from server)
        const workspaceData = localStorage.getItem('rootuip_workspace_data');
        if (workspaceData) {
            const data = JSON.parse(workspaceData);
            this.comments = new Map(data.comments || []);
            this.activities = data.activities || [];
        }
        
        // Load team members
        this.loadTeamMembers();
    }
    
    // Load team members
    loadTeamMembers() {
        // Example team members (in production, load from server)
        const members = [
            { id: 'user1', name: 'Alice Johnson', avatar: null, role: 'admin', color: '#ff6b6b' },
            { id: 'user2', name: 'Bob Smith', avatar: null, role: 'editor', color: '#4ecdc4' },
            { id: 'user3', name: 'Carol Davis', avatar: null, role: 'collaborator', color: '#45b7d1' },
            { id: 'user4', name: 'David Wilson', avatar: null, role: 'viewer', color: '#96ceb4' }
        ];
        
        members.forEach(member => {
            this.teamMembers.set(member.id, member);
        });
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleUserInactive();
            } else {
                this.handleUserActive();
            }
        });
        
        // Listen for before unload
        window.addEventListener('beforeunload', () => {
            this.handleUserDisconnect();
        });
    }
    
    // User management methods
    setCurrentUser(user) {
        this.currentUser = { ...user, isOnline: true };
        this.emit('collaboration:user_set', this.currentUser);
    }
    
    joinWorkspace(workspaceId) {
        this.currentWorkspace = workspaceId;
        
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'join_workspace',
                data: {
                    workspaceId,
                    user: this.currentUser
                }
            }));
        }
        
        this.emit('collaboration:workspace_joined', workspaceId);
    }
    
    leaveWorkspace() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'leave_workspace',
                data: {
                    workspaceId: this.currentWorkspace,
                    userId: this.currentUser.id
                }
            }));
        }
        
        this.currentWorkspace = null;
        this.activeUsers.clear();
        this.clearAllCursors();
        
        this.emit('collaboration:workspace_left');
    }
    
    // Handle user events
    handleUserJoined(data) {
        this.activeUsers.set(data.user.id, data.user);
        this.updateUserAvatars();
        this.addActivity({
            type: 'user_joined',
            user: data.user,
            timestamp: new Date()
        });
        
        this.emit('collaboration:user_joined', data.user);
    }
    
    handleUserLeft(data) {
        this.activeUsers.delete(data.userId);
        this.removeCursor(data.userId);
        this.updateUserAvatars();
        this.addActivity({
            type: 'user_left',
            userId: data.userId,
            timestamp: new Date()
        });
        
        this.emit('collaboration:user_left', data.userId);
    }
    
    handleUserActive() {
        this.currentUser.isOnline = true;
        this.broadcastUserStatus('active');
    }
    
    handleUserInactive() {
        this.currentUser.isOnline = false;
        this.broadcastUserStatus('inactive');
    }
    
    handleUserDisconnect() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'user_disconnect',
                data: {
                    userId: this.currentUser.id,
                    workspaceId: this.currentWorkspace
                }
            }));
        }
    }
    
    // Cursor and selection methods
    broadcastCursorPosition(x, y) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        this.websocket.send(JSON.stringify({
            type: 'cursor_update',
            data: {
                userId: this.currentUser.id,
                x, y,
                timestamp: new Date()
            }
        }));
    }
    
    broadcastSelection(range) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        this.websocket.send(JSON.stringify({
            type: 'selection_update',
            data: {
                userId: this.currentUser.id,
                range: {
                    startContainer: this.getElementPath(range.startContainer),
                    startOffset: range.startOffset,
                    endContainer: this.getElementPath(range.endContainer),
                    endOffset: range.endOffset
                },
                timestamp: new Date()
            }
        }));
    }
    
    handleCursorUpdate(data) {
        if (data.userId === this.currentUser.id) return;
        
        this.updateUserCursor(data.userId, data.x, data.y);
    }
    
    handleSelectionUpdate(data) {
        if (data.userId === this.currentUser.id) return;
        
        this.updateUserSelection(data.userId, data.range);
    }
    
    updateUserCursor(userId, x, y) {
        const user = this.activeUsers.get(userId);
        if (!user) return;
        
        let cursor = document.getElementById(`cursor-${userId}`);
        
        if (x === null || y === null) {
            // Remove cursor
            if (cursor) {
                cursor.remove();
            }
            return;
        }
        
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = `cursor-${userId}`;
            cursor.className = 'user-cursor';
            cursor.dataset.userName = user.name;
            cursor.style.setProperty('--user-color', user.color);
            document.body.appendChild(cursor);
        }
        
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
    }
    
    updateUserSelection(userId, range) {
        const user = this.activeUsers.get(userId);
        if (!user) return;
        
        // Remove existing selection
        const existingSelection = document.getElementById(`selection-${userId}`);
        if (existingSelection) {
            existingSelection.remove();
        }
        
        // Create new selection overlay
        const selection = document.createElement('div');
        selection.id = `selection-${userId}`;
        selection.className = 'user-selection';
        selection.style.setProperty('--user-color', user.color);
        
        // Calculate selection bounds (simplified)
        // In a real implementation, you'd properly resolve the range
        selection.style.left = '0px';
        selection.style.top = '0px';
        selection.style.width = '100px';
        selection.style.height = '20px';
        
        document.body.appendChild(selection);
    }
    
    removeCursor(userId) {
        const cursor = document.getElementById(`cursor-${userId}`);
        if (cursor) {
            cursor.remove();
        }
        
        const selection = document.getElementById(`selection-${userId}`);
        if (selection) {
            selection.remove();
        }
    }
    
    clearAllCursors() {
        document.querySelectorAll('.user-cursor, .user-selection').forEach(element => {
            element.remove();
        });
    }
    
    // Comments methods
    addComment(content, elementId = null, position = null) {
        const comment = {
            id: this.generateId('comment'),
            content: this.processMentions(content),
            author: this.currentUser,
            timestamp: new Date(),
            elementId,
            position,
            replies: []
        };
        
        this.comments.set(comment.id, comment);
        this.broadcastComment('comment_added', comment);
        this.renderComment(comment);
        
        // Add to activity feed
        this.addActivity({
            type: 'comment_added',
            user: this.currentUser,
            comment,
            timestamp: new Date()
        });
        
        this.emit('collaboration:comment_added', comment);
        return comment;
    }
    
    updateComment(commentId, content) {
        const comment = this.comments.get(commentId);
        if (!comment) return;
        
        comment.content = this.processMentions(content);
        comment.updatedAt = new Date();
        
        this.broadcastComment('comment_updated', comment);
        this.renderComment(comment);
        
        this.emit('collaboration:comment_updated', comment);
    }
    
    deleteComment(commentId) {
        const comment = this.comments.get(commentId);
        if (!comment) return;
        
        this.comments.delete(commentId);
        this.broadcastComment('comment_deleted', { id: commentId });
        
        // Remove from DOM
        const commentElement = document.getElementById(`comment-${commentId}`);
        if (commentElement) {
            commentElement.remove();
        }
        
        this.emit('collaboration:comment_deleted', commentId);
    }
    
    broadcastComment(action, comment) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        this.websocket.send(JSON.stringify({
            type: action,
            data: comment
        }));
    }
    
    handleCommentAdded(comment) {
        if (comment.author.id === this.currentUser.id) return;
        
        this.comments.set(comment.id, comment);
        this.renderComment(comment);
        
        // Show notification if mentioned
        if (this.isUserMentioned(comment.content, this.currentUser.id)) {
            this.showNotification({
                type: 'mention',
                title: 'You were mentioned',
                message: `${comment.author.name} mentioned you in a comment`,
                comment
            });
        }
        
        this.emit('collaboration:comment_received', comment);
    }
    
    handleCommentUpdated(comment) {
        if (comment.author.id === this.currentUser.id) return;
        
        this.comments.set(comment.id, comment);
        this.renderComment(comment);
        
        this.emit('collaboration:comment_updated', comment);
    }
    
    renderComment(comment) {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;
        
        let commentElement = document.getElementById(`comment-${comment.id}`);
        
        if (!commentElement) {
            commentElement = document.createElement('div');
            commentElement.id = `comment-${comment.id}`;
            commentElement.className = 'comment-item';
            commentsList.appendChild(commentElement);
        }
        
        commentElement.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.author.name}</span>
                <span class="comment-time">${this.formatTime(comment.timestamp)}</span>
            </div>
            <div class="comment-content">${comment.content}</div>
        `;
    }
    
    // Mention methods
    handleMentionInput(event) {
        if (!this.config.enableMentions) return;
        
        const input = event.target;
        const value = input.value;
        const cursorPos = input.selectionStart;
        
        // Find @ symbol before cursor
        const beforeCursor = value.substring(0, cursorPos);
        const mentionMatch = beforeCursor.match(/@(\w*)$/);
        
        if (mentionMatch) {
            const query = mentionMatch[1];
            this.showMentionDropdown(input, query, cursorPos - mentionMatch[0].length);
        } else {
            this.hideMentionDropdown();
        }
    }
    
    showMentionDropdown(input, query, position) {
        const dropdown = document.getElementById('mention-dropdown');
        const rect = input.getBoundingClientRect();
        
        // Calculate position
        const inputStyle = window.getComputedStyle(input);
        const fontSize = parseInt(inputStyle.fontSize);
        const lineHeight = parseInt(inputStyle.lineHeight) || fontSize * 1.2;
        
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.top + lineHeight) + 'px';
        
        // Filter team members
        const matches = Array.from(this.teamMembers.values())
            .filter(member => member.name.toLowerCase().includes(query.toLowerCase()));
        
        dropdown.innerHTML = matches.map(member => `
            <div class="mention-option" data-user-id="${member.id}" data-user-name="${member.name}">
                <div class="mention-avatar" style="background: ${member.color}"></div>
                <span>${member.name}</span>
            </div>
        `).join('');
        
        // Add event listeners
        dropdown.querySelectorAll('.mention-option').forEach(option => {
            option.addEventListener('click', () => {
                this.insertMention(input, option.dataset.userId, option.dataset.userName, position);
            });
        });
        
        dropdown.classList.remove('hidden');
    }
    
    hideMentionDropdown() {
        const dropdown = document.getElementById('mention-dropdown');
        dropdown.classList.add('hidden');
    }
    
    insertMention(input, userId, userName, position) {
        const value = input.value;
        const mention = `@${userName}`;
        
        // Find the @ symbol and replace with mention
        const beforeAt = value.substring(0, position);
        const afterMention = value.substring(input.selectionStart);
        
        input.value = beforeAt + mention + ' ' + afterMention;
        input.setSelectionRange(position + mention.length + 1, position + mention.length + 1);
        
        this.hideMentionDropdown();
    }
    
    processMentions(content) {
        // Convert @mentions to clickable mentions
        return content.replace(/@(\w+)/g, (match, username) => {
            const member = Array.from(this.teamMembers.values())
                .find(m => m.name.toLowerCase() === username.toLowerCase());
            
            if (member) {
                return `<span class="mention" data-user-id="${member.id}">@${member.name}</span>`;
            }
            return match;
        });
    }
    
    isUserMentioned(content, userId) {
        const user = this.teamMembers.get(userId);
        if (!user) return false;
        
        return content.includes(`@${user.name}`) || content.includes(`data-user-id="${userId}"`);
    }
    
    // Activity feed methods
    addActivity(activity) {
        activity.id = this.generateId('activity');
        this.activities.unshift(activity);
        
        // Keep only last 100 activities
        if (this.activities.length > 100) {
            this.activities = this.activities.slice(0, 100);
        }
        
        this.renderActivity(activity);
        this.broadcastActivity(activity);
        
        this.emit('collaboration:activity_added', activity);
    }
    
    renderActivity(activity) {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;
        
        const activityElement = document.createElement('div');
        activityElement.className = 'activity-item';
        activityElement.innerHTML = `
            <div class="activity-icon">${this.getActivityIcon(activity.type)}</div>
            <div class="activity-content">
                <div class="activity-text">${this.getActivityText(activity)}</div>
                <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
            </div>
        `;
        
        activityList.insertBefore(activityElement, activityList.firstChild);
        
        // Keep only last 50 activities in DOM
        while (activityList.children.length > 50) {
            activityList.removeChild(activityList.lastChild);
        }
    }
    
    getActivityIcon(type) {
        const icons = {
            user_joined: '👋',
            user_left: '👋',
            comment_added: '💬',
            edit_made: '✏️',
            file_shared: '📤',
            mention: '@',
            task_completed: '✅'
        };
        return icons[type] || '📝';
    }
    
    getActivityText(activity) {
        switch (activity.type) {
            case 'user_joined':
                return `${activity.user.name} joined the workspace`;
            case 'user_left':
                return `${this.teamMembers.get(activity.userId)?.name || 'Someone'} left the workspace`;
            case 'comment_added':
                return `${activity.user.name} added a comment`;
            case 'edit_made':
                return `${activity.user.name} made an edit`;
            case 'file_shared':
                return `${activity.user.name} shared a file`;
            default:
                return 'Activity occurred';
        }
    }
    
    filterActivities(filter) {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;
        
        const items = activityList.querySelectorAll('.activity-item');
        
        items.forEach((item, index) => {
            const activity = this.activities[index];
            if (!activity) return;
            
            const shouldShow = filter === 'all' || activity.type.includes(filter);
            item.style.display = shouldShow ? 'flex' : 'none';
        });
    }
    
    broadcastActivity(activity) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        this.websocket.send(JSON.stringify({
            type: 'activity_update',
            data: activity
        }));
    }
    
    handleActivityUpdate(activity) {
        if (activity.user?.id === this.currentUser.id) return;
        
        this.activities.unshift(activity);
        this.renderActivity(activity);
        
        this.emit('collaboration:activity_received', activity);
    }
    
    // Notification methods
    showNotification(notification) {
        notification.id = this.generateId('notification');
        notification.timestamp = new Date();
        notification.read = false;
        
        this.notifications.unshift(notification);
        this.updateNotificationCount();
        this.renderNotification(notification);
        
        // Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: notification.id
            });
        }
        
        this.emit('collaboration:notification_shown', notification);
    }
    
    markNotificationRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.updateNotificationCount();
        }
    }
    
    markAllNotificationsRead() {
        this.notifications.forEach(n => n.read = true);
        this.updateNotificationCount();
        this.renderNotifications();
    }
    
    updateNotificationCount() {
        const count = this.notifications.filter(n => !n.read).length;
        const countElement = document.getElementById('notification-count');
        if (countElement) {
            countElement.textContent = count;
            countElement.style.display = count > 0 ? 'inline' : 'none';
        }
    }
    
    renderNotification(notification) {
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) return;
        
        const element = document.createElement('div');
        element.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
            </div>
        `;
        
        element.addEventListener('click', () => {
            this.markNotificationRead(notification.id);
        });
        
        notificationList.insertBefore(element, notificationList.firstChild);
    }
    
    renderNotifications() {
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) return;
        
        notificationList.innerHTML = '';
        this.notifications.forEach(notification => {
            this.renderNotification(notification);
        });
    }
    
    handleNotification(notification) {
        this.showNotification(notification);
    }
    
    // UI control methods
    toggleCommentsPanel() {
        const panel = document.getElementById('comments-panel');
        if (panel.classList.contains('hidden')) {
            this.showCommentsPanel();
        } else {
            this.hideCommentsPanel();
        }
    }
    
    showCommentsPanel() {
        const panel = document.getElementById('comments-panel');
        panel.classList.remove('hidden');
        
        // Render all comments
        const commentsList = document.getElementById('comments-list');
        commentsList.innerHTML = '';
        
        Array.from(this.comments.values())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .forEach(comment => this.renderComment(comment));
    }
    
    hideCommentsPanel() {
        const panel = document.getElementById('comments-panel');
        panel.classList.add('hidden');
    }
    
    toggleActivityFeed() {
        const feed = document.getElementById('activity-feed');
        if (feed.classList.contains('hidden')) {
            this.showActivityFeed();
        } else {
            this.hideActivityFeed();
        }
    }
    
    showActivityFeed() {
        const feed = document.getElementById('activity-feed');
        feed.classList.remove('hidden');
        
        // Render all activities
        const activityList = document.getElementById('activity-list');
        activityList.innerHTML = '';
        
        this.activities.forEach(activity => this.renderActivity(activity));
    }
    
    hideActivityFeed() {
        const feed = document.getElementById('activity-feed');
        feed.classList.add('hidden');
    }
    
    toggleNotificationCenter() {
        const center = document.getElementById('notification-center');
        if (center.classList.contains('hidden')) {
            this.showNotificationCenter();
        } else {
            this.hideNotificationCenter();
        }
    }
    
    showNotificationCenter() {
        const center = document.getElementById('notification-center');
        center.classList.remove('hidden');
        this.renderNotifications();
    }
    
    hideNotificationCenter() {
        const center = document.getElementById('notification-center');
        center.classList.add('hidden');
    }
    
    updateUserAvatars() {
        const avatarsContainer = document.getElementById('user-avatars');
        if (!avatarsContainer) return;
        
        avatarsContainer.innerHTML = '';
        
        this.activeUsers.forEach(user => {
            const avatar = document.createElement('div');
            avatar.className = `user-avatar ${user.isOnline ? 'online' : ''}`;
            avatar.style.setProperty('--user-color', user.color);
            avatar.style.background = user.avatar || user.color;
            avatar.title = user.name;
            
            if (user.avatar) {
                avatar.style.backgroundImage = `url(${user.avatar})`;
                avatar.style.backgroundSize = 'cover';
            } else {
                avatar.textContent = user.name.charAt(0).toUpperCase();
            }
            
            avatarsContainer.appendChild(avatar);
        });
    }
    
    showShareWorkspaceDialog() {
        // Create share dialog (simplified)
        const dialog = document.createElement('div');
        dialog.className = 'share-dialog';
        dialog.innerHTML = `
            <div class="dialog-backdrop"></div>
            <div class="dialog-content">
                <h3>Share Workspace</h3>
                <input type="email" placeholder="Enter email address" id="share-email">
                <select id="share-role">
                    <option value="viewer">Viewer</option>
                    <option value="commenter">Commenter</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                </select>
                <div class="dialog-actions">
                    <button class="btn-secondary" onclick="this.closest('.share-dialog').remove()">Cancel</button>
                    <button class="btn-primary" onclick="this.closest('.share-dialog').remove()">Send Invite</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }
    
    // Utility methods
    formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return time.toLocaleDateString();
    }
    
    generateId(prefix = 'item') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getElementPath(element) {
        // Generate a unique path to an element (simplified)
        const path = [];
        let current = element;
        
        while (current && current !== document) {
            let index = 0;
            let sibling = current.previousSibling;
            
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            
            path.unshift(`${current.tagName.toLowerCase()}[${index}]`);
            current = current.parentElement;
        }
        
        return path.join(' > ');
    }
    
    // Collaborative editing methods
    handleContentChange(element, event) {
        // Broadcast content changes for real-time collaboration
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        const change = {
            elementId: element.id || this.getElementPath(element),
            content: element.value || element.textContent,
            selection: {
                start: element.selectionStart,
                end: element.selectionEnd
            },
            timestamp: new Date()
        };
        
        this.websocket.send(JSON.stringify({
            type: 'content_change',
            data: {
                userId: this.currentUser.id,
                change
            }
        }));
    }
    
    // Save workspace data
    saveWorkspaceData() {
        const data = {
            comments: Array.from(this.comments.entries()),
            activities: this.activities,
            timestamp: new Date()
        };
        
        localStorage.setItem('rootuip_workspace_data', JSON.stringify(data));
    }
    
    // Get collaboration state
    getCollaborationState() {
        return {
            currentUser: this.currentUser,
            activeUsers: Array.from(this.activeUsers.values()),
            comments: Array.from(this.comments.values()),
            activities: this.activities,
            notifications: this.notifications.filter(n => !n.read),
            isConnected: this.websocket?.readyState === WebSocket.OPEN
        };
    }
}

module.exports = TeamCollaborationManager;