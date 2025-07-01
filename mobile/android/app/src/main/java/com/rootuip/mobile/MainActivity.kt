package com.rootuip.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.navigation.compose.*
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import com.google.maps.android.compose.*
import com.rootuip.mobile.ui.theme.ROOTUIPTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.Executor

class MainActivity : ComponentActivity() {
    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var promptInfo: BiometricPrompt.PromptInfo
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setupBiometricAuth()
        
        setContent {
            ROOTUIPTheme {
                ROOTUIPApp(
                    onAuthRequired = { callback ->
                        authenticateWithBiometric(callback)
                    }
                )
            }
        }
    }
    
    private fun setupBiometricAuth() {
        executor = ContextCompat.getMainExecutor(this)
        biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    // Handle error
                }
                
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    // Authentication succeeded
                }
                
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Authentication failed
                }
            })
        
        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Authenticate to ROOTUIP")
            .setSubtitle("Use your biometric credential")
            .setNegativeButtonText("Use password")
            .build()
    }
    
    private fun authenticateWithBiometric(callback: (Boolean) -> Unit) {
        val biometricManager = BiometricManager.from(this)
        when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                biometricPrompt.authenticate(promptInfo)
            }
            else -> {
                // Biometric not available, use alternative
                callback(true)
            }
        }
    }
}

@Composable
fun ROOTUIPApp(
    onAuthRequired: ((Boolean) -> Unit) -> Unit
) {
    val navController = rememberNavController()
    val viewModel: MainViewModel = viewModel()
    var isAuthenticated by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        if (!isAuthenticated) {
            onAuthRequired { success ->
                isAuthenticated = success
            }
        }
    }
    
    if (isAuthenticated) {
        Scaffold(
            bottomBar = {
                BottomNavigationBar(navController)
            }
        ) { paddingValues ->
            NavigationHost(
                navController = navController,
                viewModel = viewModel,
                modifier = Modifier.padding(paddingValues)
            )
        }
    } else {
        LoginScreen(
            onLoginSuccess = { isAuthenticated = true }
        )
    }
}

@Composable
fun NavigationHost(
    navController: NavController,
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route,
        modifier = modifier
    ) {
        composable(Screen.Dashboard.route) {
            DashboardScreen(viewModel)
        }
        composable(Screen.Tracking.route) {
            ContainerTrackingScreen(viewModel)
        }
        composable(Screen.Scan.route) {
            DocumentScanScreen(viewModel)
        }
        composable(Screen.Alerts.route) {
            AlertsScreen(viewModel)
        }
        composable(Screen.More.route) {
            MoreScreen(viewModel)
        }
    }
}

@Composable
fun BottomNavigationBar(navController: NavController) {
    val items = listOf(
        Screen.Dashboard,
        Screen.Tracking,
        Screen.Scan,
        Screen.Alerts,
        Screen.More
    )
    
    NavigationBar {
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route
        
        items.forEach { screen ->
            NavigationBarItem(
                icon = { Icon(screen.icon, contentDescription = screen.label) },
                label = { Text(screen.label) },
                selected = currentRoute == screen.route,
                onClick = {
                    navController.navigate(screen.route) {
                        popUpTo(navController.graph.startDestinationId)
                        launchSingleTop = true
                    }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(viewModel: MainViewModel) {
    val metrics by viewModel.metrics.collectAsState()
    val containers by viewModel.recentContainers.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val coroutineScope = rememberCoroutineScope()
    
    SwipeRefresh(
        state = rememberSwipeRefreshState(isRefreshing),
        onRefresh = {
            coroutineScope.launch {
                viewModel.refreshData()
            }
        }
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                // Header
                Column {
                    Text(
                        text = "Good ${getGreeting()}",
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "Executive Dashboard",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            
            item {
                // Metrics Grid
                MetricsGrid(metrics)
            }
            
            item {
                // Revenue Card
                RevenueCard(metrics.monthlyRevenue)
            }
            
            item {
                // Charts
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    ShipmentTrendChart()
                    ContainerStatusChart()
                }
            }
            
            item {
                Text(
                    text = "Recent Containers",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
            
            items(containers) { container ->
                ContainerCard(container) {
                    // Navigate to detail
                }
            }
        }
    }
}

@Composable
fun MetricsGrid(metrics: Metrics) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Total Containers",
                value = metrics.totalContainers.toString(),
                subtitle = "Tracked globally",
                icon = Icons.Default.LocalShipping,
                color = Color(0xFF4CAF50)
            )
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Active Shipments",
                value = metrics.activeShipments.toString(),
                subtitle = "In transit",
                icon = Icons.Default.DirectionsBoat,
                color = Color(0xFF2196F3)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "On-Time Delivery",
                value = "${metrics.onTimeDelivery}%",
                subtitle = "This month",
                icon = Icons.Default.CheckCircle,
                color = Color(0xFF8BC34A)
            )
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Critical Alerts",
                value = metrics.criticalAlerts.toString(),
                subtitle = "Require attention",
                icon = Icons.Default.Warning,
                color = Color(0xFFFF5722)
            )
        }
    }
}

@Composable
fun MetricCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    color: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContainerTrackingScreen(viewModel: MainViewModel) {
    val containers by viewModel.containers.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var selectedContainer by remember { mutableStateOf<Container?>(null) }
    var showScanner by remember { mutableStateOf(false) }
    
    Box(modifier = Modifier.fillMaxSize()) {
        // Map
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = rememberCameraPositionState {
                position = CameraPosition.fromLatLngZoom(
                    com.google.android.gms.maps.model.LatLng(37.7749, -122.4194),
                    10f
                )
            },
            properties = MapProperties(isMyLocationEnabled = true),
            uiSettings = MapUiSettings(myLocationButtonEnabled = true)
        ) {
            containers.forEach { container ->
                Marker(
                    state = MarkerState(
                        position = com.google.android.gms.maps.model.LatLng(
                            container.latitude,
                            container.longitude
                        )
                    ),
                    title = container.id,
                    snippet = container.status.name,
                    onClick = {
                        selectedContainer = container
                        false
                    }
                )
            }
        }
        
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Search Bar
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(28.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Search,
                        contentDescription = "Search",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search container ID...") },
                        modifier = Modifier.weight(1f),
                        colors = TextFieldDefaults.textFieldColors(
                            containerColor = Color.Transparent,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent
                        ),
                        singleLine = true
                    )
                    IconButton(onClick = { showScanner = true }) {
                        Icon(
                            Icons.Default.QrCodeScanner,
                            contentDescription = "Scan QR",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            // Container List
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(containers.filter { 
                    searchQuery.isEmpty() || it.id.contains(searchQuery, ignoreCase = true) 
                }) { container ->
                    ContainerTrackingCard(
                        container = container,
                        isSelected = selectedContainer?.id == container.id,
                        onClick = { selectedContainer = container }
                    )
                }
            }
            
            // Selected Container Details
            AnimatedVisibility(
                visible = selectedContainer != null,
                enter = slideInVertically(initialOffsetY = { it }),
                exit = slideOutVertically(targetOffsetY = { it })
            ) {
                selectedContainer?.let { container ->
                    ContainerDetailCard(
                        container = container,
                        onClose = { selectedContainer = null }
                    )
                }
            }
        }
    }
    
    if (showScanner) {
        QRScannerDialog(
            onDismiss = { showScanner = false },
            onCodeScanned = { code ->
                searchQuery = code
                showScanner = false
            }
        )
    }
}

@Composable
fun ContainerTrackingCard(
    container: Container,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .width(280.dp)
            .height(120.dp),
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) 
                MaterialTheme.colorScheme.primaryContainer 
            else 
                MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = container.id,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                StatusChip(status = container.status)
            }
            
            Column {
                Text(
                    text = container.destination,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        Icons.Default.Schedule,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "ETA: ${container.eta}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
fun StatusChip(status: ContainerStatus) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = when (status) {
            ContainerStatus.IN_TRANSIT -> Color(0xFF2196F3)
            ContainerStatus.AT_PORT -> Color(0xFFFF9800)
            ContainerStatus.DELIVERED -> Color(0xFF4CAF50)
            ContainerStatus.DELAYED -> Color(0xFFF44336)
        }.copy(alpha = 0.2f)
    ) {
        Text(
            text = status.displayName,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = when (status) {
                ContainerStatus.IN_TRANSIT -> Color(0xFF2196F3)
                ContainerStatus.AT_PORT -> Color(0xFFFF9800)
                ContainerStatus.DELIVERED -> Color(0xFF4CAF50)
                ContainerStatus.DELAYED -> Color(0xFFF44336)
            }
        )
    }
}

// Navigation
sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    object Tracking : Screen("tracking", "Track", Icons.Default.LocationOn)
    object Scan : Screen("scan", "Scan", Icons.Default.CameraAlt)
    object Alerts : Screen("alerts", "Alerts", Icons.Default.Notifications)
    object More : Screen("more", "More", Icons.Default.MoreHoriz)
}

// Utility functions
fun getGreeting(): String {
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when (hour) {
        in 0..11 -> "Morning"
        in 12..16 -> "Afternoon"
        else -> "Evening"
    }
}