#!/usr/bin/env node

/**
 * ROOTUIP High Availability Architecture
 * Multi-region active-active setup with automatic failover
 */

const AWS = require('aws-sdk');
const { EventEmitter } = require('events');
const Redis = require('ioredis');
const { Pool } = require('pg');
const haproxy = require('haproxy-sdk');
const consul = require('consul');

class HighAvailabilityArchitecture extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            regions: config.regions || ['us-east-1', 'us-west-2', 'eu-west-1'],
            primaryRegion: config.primaryRegion || 'us-east-1',
            targetUptime: config.targetUptime || 99.99, // 99.99% = 52.56 minutes/year
            healthCheckInterval: config.healthCheckInterval || 5000,
            failoverThreshold: config.failoverThreshold || 3, // consecutive failures
            replicationLag: config.replicationLag || 1000, // 1 second max lag
            ...config
        };
        
        // AWS services per region
        this.awsServices = {};
        this.initializeAWSServices();
        
        // Global services
        this.route53 = new AWS.Route53();
        this.cloudfront = new AWS.CloudFront();
        
        // Service discovery
        this.consul = consul({
            host: config.consulHost || 'consul.rootuip.com',
            port: config.consulPort || 8500
        });
        
        // Load balancers
        this.loadBalancers = new Map();
        
        // Database clusters
        this.databaseClusters = new Map();
        
        // Cache clusters
        this.cacheClusters = new Map();
        
        // Health monitoring
        this.healthMonitor = new HealthMonitor(this);
        
        // Failover manager
        this.failoverManager = new FailoverManager(this);
        
        // Replication manager
        this.replicationManager = new ReplicationManager(this);
        
        // Traffic manager
        this.trafficManager = new TrafficManager(this);
        
        // Initialize architecture
        this.initialize();
    }
    
    // Initialize AWS services for each region
    initializeAWSServices() {
        for (const region of this.config.regions) {
            this.awsServices[region] = {
                ec2: new AWS.EC2({ region }),
                elb: new AWS.ELBv2({ region }),
                rds: new AWS.RDS({ region }),
                elasticache: new AWS.ElastiCache({ region }),
                cloudWatch: new AWS.CloudWatch({ region }),
                autoScaling: new AWS.AutoScaling({ region })
            };
        }
    }
    
    // Initialize high availability architecture
    async initialize() {
        console.log('Initializing High Availability Architecture');
        
        try {
            // Setup multi-region infrastructure
            await this.setupMultiRegionInfrastructure();
            
            // Configure load balancing
            await this.configureLoadBalancing();
            
            // Setup database clustering
            await this.setupDatabaseClustering();
            
            // Configure cache layer
            await this.configureCacheLayer();
            
            // Setup CDN
            await this.setupCDN();
            
            // Configure monitoring
            await this.configureMonitoring();
            
            // Start health checks
            this.startHealthChecks();
            
            console.log('High Availability Architecture initialized');
            
        } catch (error) {
            console.error('Failed to initialize HA architecture:', error);
            throw error;
        }
    }
    
    // Setup multi-region infrastructure
    async setupMultiRegionInfrastructure() {
        console.log('Setting up multi-region infrastructure');
        
        for (const region of this.config.regions) {
            await this.setupRegion(region);
        }
        
        // Configure cross-region networking
        await this.configureCrossRegionNetworking();
        
        // Setup global accelerator
        await this.setupGlobalAccelerator();
    }
    
    // Setup individual region
    async setupRegion(region) {
        console.log(`Setting up region: ${region}`);
        
        const services = this.awsServices[region];
        
        // Create VPC if not exists
        const vpc = await this.ensureVPC(region);
        
        // Setup availability zones
        const azs = await this.setupAvailabilityZones(region, vpc);
        
        // Create auto-scaling groups
        const asg = await this.createAutoScalingGroup(region, {
            vpcId: vpc.VpcId,
            availabilityZones: azs,
            minSize: 3,
            maxSize: 10,
            desiredCapacity: 3,
            healthCheckGracePeriod: 300,
            healthCheckType: 'ELB'
        });
        
        // Create application load balancer
        const alb = await this.createApplicationLoadBalancer(region, {
            vpcId: vpc.VpcId,
            subnets: azs.map(az => az.subnetId),
            scheme: 'internet-facing'
        });
        
        // Register with service discovery
        await this.registerService(region, {
            name: `rootuip-${region}`,
            address: alb.DNSName,
            port: 443,
            tags: ['primary', 'api', region],
            check: {
                http: `https://${alb.DNSName}/health`,
                interval: '10s',
                timeout: '5s'
            }
        });
        
        this.loadBalancers.set(region, alb);
    }
    
    // Configure load balancing
    async configureLoadBalancing() {
        console.log('Configuring load balancing');
        
        // Configure Route53 health checks
        for (const [region, alb] of this.loadBalancers) {
            const healthCheck = await this.route53.createHealthCheck({
                CallerReference: `rootuip-${region}-${Date.now()}`,
                HealthCheckConfig: {
                    Type: 'HTTPS',
                    ResourcePath: '/health',
                    FullyQualifiedDomainName: alb.DNSName,
                    Port: 443,
                    RequestInterval: 30,
                    FailureThreshold: this.config.failoverThreshold
                },
                HealthCheckTags: [{
                    Key: 'Name',
                    Value: `rootuip-${region}-health`
                }]
            }).promise();
            
            alb.healthCheckId = healthCheck.HealthCheck.Id;
        }
        
        // Configure weighted routing policy
        await this.configureWeightedRouting();
        
        // Configure geolocation routing
        await this.configureGeolocationRouting();
        
        // Setup failover routing
        await this.configureFailoverRouting();
    }
    
    // Setup database clustering
    async setupDatabaseClustering() {
        console.log('Setting up database clustering');
        
        // Create Aurora Global Database
        const globalCluster = await this.createAuroraGlobalCluster();
        
        // Setup primary cluster
        const primaryCluster = await this.createPrimaryDatabaseCluster(
            this.config.primaryRegion,
            globalCluster
        );
        
        // Setup read replicas in other regions
        for (const region of this.config.regions) {
            if (region !== this.config.primaryRegion) {
                const replica = await this.createReadReplicaCluster(region, globalCluster);
                this.databaseClusters.set(region, replica);
            }
        }
        
        this.databaseClusters.set(this.config.primaryRegion, primaryCluster);
        
        // Configure automatic failover
        await this.configureDatabaseFailover();
        
        // Setup connection pooling
        await this.setupConnectionPooling();
    }
    
    // Create Aurora Global Cluster
    async createAuroraGlobalCluster() {
        const rds = this.awsServices[this.config.primaryRegion].rds;
        
        const globalCluster = await rds.createGlobalCluster({
            GlobalClusterIdentifier: 'rootuip-global-cluster',
            Engine: 'aurora-postgresql',
            EngineVersion: '13.7',
            StorageEncrypted: true,
            DeletionProtection: true
        }).promise();
        
        return globalCluster.GlobalCluster;
    }
    
    // Create primary database cluster
    async createPrimaryDatabaseCluster(region, globalCluster) {
        const rds = this.awsServices[region].rds;
        
        const cluster = await rds.createDBCluster({
            DBClusterIdentifier: `rootuip-primary-${region}`,
            Engine: 'aurora-postgresql',
            EngineVersion: '13.7',
            MasterUsername: 'rootuip_admin',
            MasterUserPassword: this.generateSecurePassword(),
            DatabaseName: 'rootuip',
            GlobalClusterIdentifier: globalCluster.GlobalClusterIdentifier,
            BackupRetentionPeriod: 35,
            PreferredBackupWindow: '03:00-04:00',
            PreferredMaintenanceWindow: 'sun:04:00-sun:05:00',
            EnableCloudwatchLogsExports: ['postgresql'],
            DeletionProtection: true,
            StorageEncrypted: true,
            EnableIAMDatabaseAuthentication: true
        }).promise();
        
        // Create cluster instances
        for (let i = 0; i < 3; i++) {
            await rds.createDBInstance({
                DBInstanceIdentifier: `rootuip-primary-${region}-${i}`,
                DBClusterIdentifier: cluster.DBCluster.DBClusterIdentifier,
                DBInstanceClass: 'db.r6g.xlarge',
                Engine: 'aurora-postgresql',
                PubliclyAccessible: false,
                MonitoringInterval: 60,
                MonitoringRoleArn: this.config.monitoringRoleArn
            }).promise();
        }
        
        return cluster.DBCluster;
    }
    
    // Configure cache layer
    async configureCacheLayer() {
        console.log('Configuring cache layer');
        
        for (const region of this.config.regions) {
            // Create ElastiCache replication group
            const cache = await this.createCacheCluster(region);
            this.cacheClusters.set(region, cache);
        }
        
        // Configure cache invalidation
        await this.configureCacheInvalidation();
        
        // Setup cache warming
        await this.setupCacheWarming();
    }
    
    // Create cache cluster
    async createCacheCluster(region) {
        const elasticache = this.awsServices[region].elasticache;
        
        const replicationGroup = await elasticache.createReplicationGroup({
            ReplicationGroupId: `rootuip-cache-${region}`,
            ReplicationGroupDescription: `ROOTUIP cache cluster for ${region}`,
            Engine: 'redis',
            EngineVersion: '7.0',
            CacheNodeType: 'cache.r6g.xlarge',
            NumCacheClusters: 3,
            AutomaticFailoverEnabled: true,
            MultiAZEnabled: true,
            AtRestEncryptionEnabled: true,
            TransitEncryptionEnabled: true,
            SnapshotRetentionLimit: 7,
            SnapshotWindow: '03:00-05:00',
            PreferredMaintenanceWindow: 'sun:05:00-sun:06:00',
            NotificationTopicArn: this.config.snsTopicArn
        }).promise();
        
        // Configure Redis cluster mode
        await this.configureRedisClusterMode(region, replicationGroup);
        
        return replicationGroup.ReplicationGroup;
    }
    
    // Setup CDN
    async setupCDN() {
        console.log('Setting up CDN');
        
        // Create CloudFront distribution
        const distribution = await this.cloudfront.createDistribution({
            DistributionConfig: {
                CallerReference: `rootuip-cdn-${Date.now()}`,
                Comment: 'ROOTUIP Global CDN',
                Enabled: true,
                PriceClass: 'PriceClass_All',
                HttpVersion: 'http2and3',
                IsIPV6Enabled: true,
                
                Origins: {
                    Quantity: this.config.regions.length,
                    Items: this.config.regions.map(region => ({
                        Id: `rootuip-origin-${region}`,
                        DomainName: this.loadBalancers.get(region).DNSName,
                        CustomOriginConfig: {
                            HTTPPort: 80,
                            HTTPSPort: 443,
                            OriginProtocolPolicy: 'https-only',
                            OriginSslProtocols: {
                                Quantity: 3,
                                Items: ['TLSv1', 'TLSv1.1', 'TLSv1.2']
                            }
                        },
                        OriginShield: {
                            Enabled: true,
                            OriginShieldRegion: region
                        }
                    }))
                },
                
                OriginGroups: {
                    Quantity: 1,
                    Items: [{
                        Id: 'rootuip-origin-group',
                        FailoverCriteria: {
                            StatusCodes: {
                                Quantity: 3,
                                Items: [500, 502, 503]
                            }
                        },
                        Members: {
                            Quantity: this.config.regions.length,
                            Items: this.config.regions.map((region, index) => ({
                                OriginId: `rootuip-origin-${region}`,
                                Priority: index === 0 ? 'PRIMARY' : 'SECONDARY'
                            }))
                        }
                    }]
                },
                
                DefaultCacheBehavior: {
                    TargetOriginId: 'rootuip-origin-group',
                    ViewerProtocolPolicy: 'redirect-to-https',
                    AllowedMethods: {
                        Quantity: 7,
                        Items: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
                        CachedMethods: {
                            Quantity: 2,
                            Items: ['GET', 'HEAD']
                        }
                    },
                    ForwardedValues: {
                        QueryString: true,
                        Cookies: { Forward: 'all' },
                        Headers: {
                            Quantity: 4,
                            Items: ['Authorization', 'CloudFront-Forwarded-Proto', 'Host', 'User-Agent']
                        }
                    },
                    TrustedSigners: { Enabled: false, Quantity: 0 },
                    MinTTL: 0,
                    DefaultTTL: 86400,
                    MaxTTL: 31536000,
                    Compress: true
                },
                
                CustomErrorResponses: {
                    Quantity: 2,
                    Items: [
                        {
                            ErrorCode: 503,
                            ResponsePagePath: '/maintenance.html',
                            ResponseCode: '503',
                            ErrorCachingMinTTL: 0
                        },
                        {
                            ErrorCode: 404,
                            ResponsePagePath: '/404.html',
                            ResponseCode: '404',
                            ErrorCachingMinTTL: 300
                        }
                    ]
                }
            }
        }).promise();
        
        return distribution.Distribution;
    }
    
    // Configure monitoring
    async configureMonitoring() {
        console.log('Configuring monitoring');
        
        // Create CloudWatch dashboards
        for (const region of this.config.regions) {
            await this.createRegionalDashboard(region);
        }
        
        // Create global dashboard
        await this.createGlobalDashboard();
        
        // Configure alarms
        await this.configureAlarms();
        
        // Setup log aggregation
        await this.setupLogAggregation();
    }
    
    // Start health checks
    startHealthChecks() {
        // Regional health checks
        setInterval(() => {
            this.performHealthChecks();
        }, this.config.healthCheckInterval);
        
        // Database health checks
        setInterval(() => {
            this.checkDatabaseHealth();
        }, 10000);
        
        // Cache health checks
        setInterval(() => {
            this.checkCacheHealth();
        }, 5000);
        
        // Replication lag monitoring
        setInterval(() => {
            this.monitorReplicationLag();
        }, 3000);
    }
    
    // Perform health checks
    async performHealthChecks() {
        const healthStatus = new Map();
        
        for (const region of this.config.regions) {
            try {
                const health = await this.healthMonitor.checkRegionHealth(region);
                healthStatus.set(region, health);
                
                if (!health.healthy) {
                    this.emit('region:unhealthy', { region, health });
                    
                    // Check if failover is needed
                    if (await this.failoverManager.shouldFailover(region, health)) {
                        await this.failoverManager.initiateFailover(region);
                    }
                }
            } catch (error) {
                console.error(`Health check failed for ${region}:`, error);
                healthStatus.set(region, { healthy: false, error: error.message });
            }
        }
        
        // Update global health status
        this.updateGlobalHealthStatus(healthStatus);
    }
    
    // Configure weighted routing
    async configureWeightedRouting() {
        const hostedZoneId = this.config.hostedZoneId;
        
        // Calculate weights based on capacity and performance
        const weights = await this.calculateRegionWeights();
        
        for (const [region, weight] of weights) {
            const alb = this.loadBalancers.get(region);
            
            await this.route53.changeResourceRecordSets({
                HostedZoneId: hostedZoneId,
                ChangeBatch: {
                    Changes: [{
                        Action: 'UPSERT',
                        ResourceRecordSet: {
                            Name: 'api.rootuip.com',
                            Type: 'A',
                            SetIdentifier: `weighted-${region}`,
                            Weight: weight,
                            AliasTarget: {
                                HostedZoneId: alb.CanonicalHostedZoneId,
                                DNSName: alb.DNSName,
                                EvaluateTargetHealth: true
                            }
                        }
                    }]
                }
            }).promise();
        }
    }
    
    // Configure geolocation routing
    async configureGeolocationRouting() {
        const geoMappings = {
            'us-east-1': ['US', 'CA', 'MX'],
            'us-west-2': ['US', 'CA', 'MX'],
            'eu-west-1': ['GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'NL', 'BE']
        };
        
        for (const [region, countries] of Object.entries(geoMappings)) {
            const alb = this.loadBalancers.get(region);
            if (!alb) continue;
            
            for (const country of countries) {
                await this.route53.changeResourceRecordSets({
                    HostedZoneId: this.config.hostedZoneId,
                    ChangeBatch: {
                        Changes: [{
                            Action: 'UPSERT',
                            ResourceRecordSet: {
                                Name: 'api.rootuip.com',
                                Type: 'A',
                                SetIdentifier: `geo-${country}-${region}`,
                                GeoLocation: { CountryCode: country },
                                AliasTarget: {
                                    HostedZoneId: alb.CanonicalHostedZoneId,
                                    DNSName: alb.DNSName,
                                    EvaluateTargetHealth: true
                                }
                            }
                        }]
                    }
                }).promise();
            }
        }
    }
    
    // Calculate region weights
    async calculateRegionWeights() {
        const weights = new Map();
        let totalCapacity = 0;
        
        for (const region of this.config.regions) {
            const capacity = await this.getRegionCapacity(region);
            const performance = await this.getRegionPerformance(region);
            
            // Weight = capacity * performance factor
            const weight = Math.floor(capacity * performance);
            weights.set(region, weight);
            totalCapacity += weight;
        }
        
        // Normalize weights to 0-255 range
        for (const [region, weight] of weights) {
            weights.set(region, Math.floor((weight / totalCapacity) * 255));
        }
        
        return weights;
    }
    
    // Get region capacity
    async getRegionCapacity(region) {
        const asg = await this.awsServices[region].autoScaling.describeAutoScalingGroups({
            AutoScalingGroupNames: [`rootuip-asg-${region}`]
        }).promise();
        
        if (asg.AutoScalingGroups.length > 0) {
            return asg.AutoScalingGroups[0].DesiredCapacity * 100; // Capacity score
        }
        
        return 100; // Default capacity
    }
    
    // Get region performance
    async getRegionPerformance(region) {
        const cloudWatch = this.awsServices[region].cloudWatch;
        
        const metrics = await cloudWatch.getMetricStatistics({
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'TargetResponseTime',
            Dimensions: [{
                Name: 'LoadBalancer',
                Value: this.loadBalancers.get(region)?.LoadBalancerArn
            }],
            StartTime: new Date(Date.now() - 300000), // Last 5 minutes
            EndTime: new Date(),
            Period: 300,
            Statistics: ['Average']
        }).promise();
        
        if (metrics.Datapoints.length > 0) {
            const avgResponseTime = metrics.Datapoints[0].Average;
            // Convert to performance factor (lower response time = higher factor)
            return Math.max(0.1, Math.min(1, 1000 / avgResponseTime));
        }
        
        return 1; // Default performance
    }
    
    // Helper methods
    generateSecurePassword() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('base64');
    }
    
    async ensureVPC(region) {
        const ec2 = this.awsServices[region].ec2;
        
        // Check for existing VPC
        const vpcs = await ec2.describeVpcs({
            Filters: [{
                Name: 'tag:Name',
                Values: [`rootuip-vpc-${region}`]
            }]
        }).promise();
        
        if (vpcs.Vpcs.length > 0) {
            return vpcs.Vpcs[0];
        }
        
        // Create new VPC
        const vpc = await ec2.createVpc({
            CidrBlock: '10.0.0.0/16',
            TagSpecifications: [{
                ResourceType: 'vpc',
                Tags: [{
                    Key: 'Name',
                    Value: `rootuip-vpc-${region}`
                }]
            }]
        }).promise();
        
        return vpc.Vpc;
    }
    
    async setupAvailabilityZones(region, vpc) {
        const ec2 = this.awsServices[region].ec2;
        
        // Get available AZs
        const azs = await ec2.describeAvailabilityZones({
            State: 'available'
        }).promise();
        
        const subnets = [];
        
        // Create subnets in each AZ
        for (let i = 0; i < Math.min(3, azs.AvailabilityZones.length); i++) {
            const subnet = await ec2.createSubnet({
                VpcId: vpc.VpcId,
                CidrBlock: `10.0.${i}.0/24`,
                AvailabilityZone: azs.AvailabilityZones[i].ZoneName,
                TagSpecifications: [{
                    ResourceType: 'subnet',
                    Tags: [{
                        Key: 'Name',
                        Value: `rootuip-subnet-${region}-${i}`
                    }]
                }]
            }).promise();
            
            subnets.push({
                subnetId: subnet.Subnet.SubnetId,
                availabilityZone: azs.AvailabilityZones[i].ZoneName
            });
        }
        
        return subnets;
    }
    
    async createAutoScalingGroup(region, config) {
        const autoScaling = this.awsServices[region].autoScaling;
        
        // Create launch template
        const ec2 = this.awsServices[region].ec2;
        const launchTemplate = await ec2.createLaunchTemplate({
            LaunchTemplateName: `rootuip-lt-${region}`,
            LaunchTemplateData: {
                ImageId: this.config.amiId || 'ami-0abcdef1234567890',
                InstanceType: 't3.large',
                SecurityGroupIds: [await this.ensureSecurityGroup(region, config.vpcId)],
                IamInstanceProfile: {
                    Arn: this.config.instanceProfileArn
                },
                UserData: Buffer.from(this.getUserData(region)).toString('base64'),
                Monitoring: { Enabled: true }
            }
        }).promise();
        
        // Create auto-scaling group
        await autoScaling.createAutoScalingGroup({
            AutoScalingGroupName: `rootuip-asg-${region}`,
            LaunchTemplate: {
                LaunchTemplateId: launchTemplate.LaunchTemplate.LaunchTemplateId,
                Version: '$Latest'
            },
            MinSize: config.minSize,
            MaxSize: config.maxSize,
            DesiredCapacity: config.desiredCapacity,
            VPCZoneIdentifier: config.availabilityZones.map(az => az.subnetId).join(','),
            HealthCheckType: config.healthCheckType,
            HealthCheckGracePeriod: config.healthCheckGracePeriod,
            Tags: [{
                Key: 'Name',
                Value: `rootuip-instance-${region}`,
                PropagateAtLaunch: true
            }]
        }).promise();
        
        // Configure auto-scaling policies
        await this.configureAutoScalingPolicies(region);
    }
    
    async createApplicationLoadBalancer(region, config) {
        const elb = this.awsServices[region].elb;
        
        // Create ALB
        const alb = await elb.createLoadBalancer({
            Name: `rootuip-alb-${region}`,
            Subnets: config.subnets,
            SecurityGroups: [await this.ensureSecurityGroup(region, config.vpcId)],
            Scheme: config.scheme,
            Type: 'application',
            IpAddressType: 'dualstack',
            Tags: [{
                Key: 'Name',
                Value: `rootuip-alb-${region}`
            }]
        }).promise();
        
        // Create target group
        const targetGroup = await elb.createTargetGroup({
            Name: `rootuip-tg-${region}`,
            Protocol: 'HTTPS',
            Port: 443,
            VpcId: config.vpcId,
            HealthCheckProtocol: 'HTTPS',
            HealthCheckPath: '/health',
            HealthCheckIntervalSeconds: 30,
            HealthCheckTimeoutSeconds: 5,
            HealthyThresholdCount: 2,
            UnhealthyThresholdCount: 3,
            TargetType: 'instance'
        }).promise();
        
        // Create listener
        await elb.createListener({
            LoadBalancerArn: alb.LoadBalancers[0].LoadBalancerArn,
            Protocol: 'HTTPS',
            Port: 443,
            Certificates: [{
                CertificateArn: this.config.certificateArn
            }],
            DefaultActions: [{
                Type: 'forward',
                TargetGroupArn: targetGroup.TargetGroups[0].TargetGroupArn
            }]
        }).promise();
        
        return alb.LoadBalancers[0];
    }
    
    getUserData(region) {
        return `#!/bin/bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << EOF
{
  "metrics": {
    "namespace": "ROOTUIP",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          "used_percent",
          "inodes_free"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a query -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json -s

# Install and configure application
docker run -d \
  --name rootuip \
  --restart always \
  -p 443:443 \
  -e REGION=${region} \
  -e NODE_ENV=production \
  rootuip:latest
`;
    }
}

// Health Monitor
class HealthMonitor {
    constructor(parent) {
        this.parent = parent;
        this.healthHistory = new Map();
    }
    
    async checkRegionHealth(region) {
        const checks = {
            compute: await this.checkComputeHealth(region),
            database: await this.checkDatabaseHealth(region),
            cache: await this.checkCacheHealth(region),
            network: await this.checkNetworkHealth(region)
        };
        
        const healthy = Object.values(checks).every(check => check.healthy);
        
        const health = {
            healthy,
            checks,
            timestamp: Date.now()
        };
        
        // Update health history
        if (!this.healthHistory.has(region)) {
            this.healthHistory.set(region, []);
        }
        this.healthHistory.get(region).push(health);
        
        // Keep only last 100 entries
        const history = this.healthHistory.get(region);
        if (history.length > 100) {
            history.shift();
        }
        
        return health;
    }
    
    async checkComputeHealth(region) {
        try {
            const elb = this.parent.awsServices[region].elb;
            const alb = this.parent.loadBalancers.get(region);
            
            if (!alb) {
                return { healthy: false, reason: 'No ALB found' };
            }
            
            const health = await elb.describeTargetHealth({
                TargetGroupArn: alb.targetGroupArn
            }).promise();
            
            const healthyTargets = health.TargetHealthDescriptions.filter(
                t => t.TargetHealth.State === 'healthy'
            );
            
            const healthPercentage = healthyTargets.length / health.TargetHealthDescriptions.length;
            
            return {
                healthy: healthPercentage >= 0.5,
                healthyTargets: healthyTargets.length,
                totalTargets: health.TargetHealthDescriptions.length,
                percentage: healthPercentage
            };
            
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}

// Failover Manager
class FailoverManager {
    constructor(parent) {
        this.parent = parent;
        this.failoverHistory = new Map();
    }
    
    async shouldFailover(region, health) {
        // Check consecutive failures
        const history = this.parent.healthMonitor.healthHistory.get(region) || [];
        const recentFailures = history.slice(-this.parent.config.failoverThreshold)
            .filter(h => !h.healthy).length;
        
        return recentFailures >= this.parent.config.failoverThreshold;
    }
    
    async initiateFailover(failedRegion) {
        console.log(`Initiating failover from ${failedRegion}`);
        
        try {
            // Step 1: Remove failed region from rotation
            await this.removeFromRotation(failedRegion);
            
            // Step 2: Redistribute traffic
            await this.redistributeTraffic(failedRegion);
            
            // Step 3: Promote read replica if primary DB failed
            if (failedRegion === this.parent.config.primaryRegion) {
                await this.promoteDatabaseReplica();
            }
            
            // Step 4: Update service discovery
            await this.updateServiceDiscovery(failedRegion);
            
            // Step 5: Notify stakeholders
            await this.notifyFailover(failedRegion);
            
            // Record failover
            this.failoverHistory.set(failedRegion, {
                timestamp: Date.now(),
                reason: 'Health check failures'
            });
            
            console.log(`Failover from ${failedRegion} completed`);
            
        } catch (error) {
            console.error('Failover failed:', error);
            throw error;
        }
    }
    
    async removeFromRotation(region) {
        // Set Route53 weight to 0
        await this.parent.route53.changeResourceRecordSets({
            HostedZoneId: this.parent.config.hostedZoneId,
            ChangeBatch: {
                Changes: [{
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: 'api.rootuip.com',
                        Type: 'A',
                        SetIdentifier: `weighted-${region}`,
                        Weight: 0,
                        AliasTarget: {
                            HostedZoneId: this.parent.loadBalancers.get(region).CanonicalHostedZoneId,
                            DNSName: this.parent.loadBalancers.get(region).DNSName,
                            EvaluateTargetHealth: true
                        }
                    }
                }]
            }
        }).promise();
    }
}

// Replication Manager
class ReplicationManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async monitorReplicationLag() {
        const lags = new Map();
        
        for (const [region, cluster] of this.parent.databaseClusters) {
            if (region !== this.parent.config.primaryRegion) {
                const lag = await this.getReplicationLag(region, cluster);
                lags.set(region, lag);
                
                if (lag > this.parent.config.replicationLag) {
                    this.parent.emit('replication:lag', { region, lag });
                }
            }
        }
        
        return lags;
    }
    
    async getReplicationLag(region, cluster) {
        // Query replica lag from CloudWatch
        const cloudWatch = this.parent.awsServices[region].cloudWatch;
        
        const metrics = await cloudWatch.getMetricStatistics({
            Namespace: 'AWS/RDS',
            MetricName: 'AuroraReplicaLag',
            Dimensions: [{
                Name: 'DBClusterIdentifier',
                Value: cluster.DBClusterIdentifier
            }],
            StartTime: new Date(Date.now() - 300000),
            EndTime: new Date(),
            Period: 60,
            Statistics: ['Average']
        }).promise();
        
        if (metrics.Datapoints.length > 0) {
            return metrics.Datapoints[0].Average;
        }
        
        return 0;
    }
}

// Traffic Manager
class TrafficManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async redistributeTraffic(failedRegion) {
        // Get current weights
        const weights = await this.parent.calculateRegionWeights();
        
        // Remove failed region
        weights.delete(failedRegion);
        
        // Recalculate weights
        const totalWeight = Array.from(weights.values()).reduce((a, b) => a + b, 0);
        
        for (const [region, weight] of weights) {
            const newWeight = Math.floor((weight / totalWeight) * 255);
            weights.set(region, newWeight);
        }
        
        // Apply new weights
        for (const [region, weight] of weights) {
            await this.parent.updateRegionWeight(region, weight);
        }
    }
}

module.exports = HighAvailabilityArchitecture;