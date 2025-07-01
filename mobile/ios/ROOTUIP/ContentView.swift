//
//  ContentView.swift
//  ROOTUIP
//
//  Main app view with tab navigation
//

import SwiftUI
import MapKit
import LocalAuthentication

struct ContentView: View {
    @StateObject private var authManager = AuthenticationManager()
    @StateObject private var dataManager = DataManager()
    @State private var selectedTab = 0
    @State private var showingProfile = false
    
    var body: some View {
        if authManager.isAuthenticated {
            TabView(selection: $selectedTab) {
                DashboardView()
                    .tabItem {
                        Label("Dashboard", systemImage: "chart.bar.fill")
                    }
                    .tag(0)
                
                ContainerTrackingView()
                    .tabItem {
                        Label("Track", systemImage: "location.fill")
                    }
                    .tag(1)
                
                DocumentScanView()
                    .tabItem {
                        Label("Scan", systemImage: "camera.fill")
                    }
                    .tag(2)
                
                AlertsView()
                    .tabItem {
                        Label("Alerts", systemImage: "bell.fill")
                    }
                    .badge(dataManager.unreadAlerts)
                    .tag(3)
                
                MoreView()
                    .tabItem {
                        Label("More", systemImage: "ellipsis")
                    }
                    .tag(4)
            }
            .accentColor(.blue)
            .environmentObject(dataManager)
            .onAppear {
                setupAppearance()
            }
        } else {
            LoginView()
                .environmentObject(authManager)
        }
    }
    
    private func setupAppearance() {
        // Configure navigation bar appearance
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color("PrimaryColor"))
        appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        appearance.largeTitleTextAttributes = [.foregroundColor: UIColor.white]
        
        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        
        // Configure tab bar
        UITabBar.appearance().backgroundColor = UIColor.systemBackground
    }
}

// MARK: - Dashboard View
struct DashboardView: View {
    @EnvironmentObject var dataManager: DataManager
    @State private var isRefreshing = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Good \(greeting)")
                            .font(.title2)
                            .foregroundColor(.secondary)
                        Text("Executive Dashboard")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.top)
                    
                    // Key Metrics
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        MetricCard(
                            title: "Total Containers",
                            value: dataManager.metrics.totalContainers.formatted(),
                            subtitle: "Tracked globally",
                            icon: "shippingbox.fill",
                            color: .green
                        )
                        
                        MetricCard(
                            title: "Active Shipments",
                            value: dataManager.metrics.activeShipments.formatted(),
                            subtitle: "In transit",
                            icon: "airplane",
                            color: .blue
                        )
                        
                        MetricCard(
                            title: "On-Time Delivery",
                            value: "\(dataManager.metrics.onTimeDelivery)%",
                            subtitle: "This month",
                            icon: "checkmark.circle.fill",
                            color: .green
                        )
                        
                        MetricCard(
                            title: "Critical Alerts",
                            value: "\(dataManager.metrics.criticalAlerts)",
                            subtitle: "Require attention",
                            icon: "exclamationmark.triangle.fill",
                            color: .red
                        )
                    }
                    .padding(.horizontal)
                    
                    // Revenue Card
                    RevenueCard(revenue: dataManager.metrics.monthlyRevenue)
                        .padding(.horizontal)
                    
                    // Charts
                    VStack(spacing: 20) {
                        ShipmentTrendChart()
                        ContainerStatusChart()
                    }
                    .padding(.horizontal)
                    
                    // Recent Activity
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Recent Containers")
                            .font(.headline)
                        
                        ForEach(dataManager.recentContainers) { container in
                            NavigationLink(destination: ContainerDetailView(container: container)) {
                                ContainerRow(container: container)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 32)
                }
            }
            .refreshable {
                await refreshData()
            }
            .navigationBarHidden(true)
            .background(Color(.systemGroupedBackground))
        }
    }
    
    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Morning"
        case 12..<17: return "Afternoon"
        default: return "Evening"
        }
    }
    
    private func refreshData() async {
        isRefreshing = true
        await dataManager.refreshData()
        isRefreshing = false
    }
}

// MARK: - Container Tracking View
struct ContainerTrackingView: View {
    @EnvironmentObject var dataManager: DataManager
    @State private var searchText = ""
    @State private var selectedContainer: Container?
    @State private var showingScanner = false
    @State private var mapRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
    )
    
    var body: some View {
        NavigationView {
            ZStack {
                // Map
                Map(coordinateRegion: $mapRegion, 
                    showsUserLocation: true,
                    annotationItems: dataManager.containers) { container in
                    MapAnnotation(coordinate: container.coordinate) {
                        ContainerMapPin(container: container, isSelected: selectedContainer?.id == container.id)
                            .onTapGesture {
                                withAnimation {
                                    selectedContainer = container
                                }
                            }
                    }
                }
                .ignoresSafeArea()
                
                // Search Bar
                VStack {
                    HStack {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.secondary)
                            
                            TextField("Search container ID...", text: $searchText)
                                .textFieldStyle(PlainTextFieldStyle())
                                .autocapitalization(.allCharacters)
                                .disableAutocorrection(true)
                                .onSubmit {
                                    searchContainer()
                                }
                            
                            if !searchText.isEmpty {
                                Button(action: { searchText = "" }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.secondary)
                                }
                            }
                            
                            Button(action: { showingScanner = true }) {
                                Image(systemName: "qrcode.viewfinder")
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                        .shadow(color: Color.black.opacity(0.1), radius: 5)
                    }
                    .padding()
                    
                    Spacer()
                    
                    // Container List
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 16) {
                            ForEach(filteredContainers) { container in
                                ContainerCard(container: container)
                                    .onTapGesture {
                                        selectContainer(container)
                                    }
                            }
                        }
                        .padding(.horizontal)
                    }
                    .frame(height: 140)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color(.systemBackground).opacity(0),
                                Color(.systemBackground)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    
                    // Selected Container Details
                    if let container = selectedContainer {
                        ContainerDetailCard(container: container)
                            .transition(.move(edge: .bottom))
                            .padding()
                    }
                }
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $showingScanner) {
                QRScannerView { code in
                    searchText = code
                    showingScanner = false
                    searchContainer()
                }
            }
        }
    }
    
    private var filteredContainers: [Container] {
        if searchText.isEmpty {
            return dataManager.containers
        } else {
            return dataManager.containers.filter { 
                $0.id.localizedCaseInsensitiveContains(searchText) 
            }
        }
    }
    
    private func searchContainer() {
        if let container = dataManager.containers.first(where: { 
            $0.id.localizedCaseInsensitiveContains(searchText) 
        }) {
            selectContainer(container)
        }
    }
    
    private func selectContainer(_ container: Container) {
        withAnimation {
            selectedContainer = container
            mapRegion.center = container.coordinate
            mapRegion.span = MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        }
    }
}

// MARK: - Component Views
struct MetricCard: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(value)
                    .font(.title)
                    .fontWeight(.bold)
                
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(subtitle)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 5)
    }
}

struct ContainerCard: View {
    let container: Container
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(container.id)
                    .font(.caption)
                    .fontWeight(.semibold)
                Spacer()
                StatusBadge(status: container.status)
            }
            
            Text(container.destination)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(1)
            
            HStack {
                Image(systemName: "clock")
                    .font(.caption2)
                Text(container.eta)
                    .font(.caption2)
            }
            .foregroundColor(.secondary)
            
            if let delay = container.delay {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption2)
                    Text("Delayed by \(delay)")
                        .font(.caption2)
                }
                .foregroundColor(.orange)
            }
        }
        .padding()
        .frame(width: 280)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 3)
    }
}

struct StatusBadge: View {
    let status: ContainerStatus
    
    var body: some View {
        Text(status.rawValue)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.color.opacity(0.2))
            .foregroundColor(status.color)
            .cornerRadius(8)
    }
}

// MARK: - Models
enum ContainerStatus: String, CaseIterable {
    case inTransit = "In Transit"
    case atPort = "At Port"
    case delivered = "Delivered"
    case delayed = "Delayed"
    
    var color: Color {
        switch self {
        case .inTransit: return .blue
        case .atPort: return .orange
        case .delivered: return .green
        case .delayed: return .red
        }
    }
}

struct Container: Identifiable {
    let id: String
    let status: ContainerStatus
    let location: CLLocationCoordinate2D
    let destination: String
    let eta: String
    let lastUpdate: String
    let delay: String?
    
    var coordinate: CLLocationCoordinate2D { location }
}

// MARK: - Data Manager
class DataManager: ObservableObject {
    @Published var containers: [Container] = []
    @Published var recentContainers: [Container] = []
    @Published var metrics = Metrics()
    @Published var unreadAlerts = 3
    
    struct Metrics {
        var totalContainers = 847_293
        var activeShipments = 42_156
        var onTimeDelivery = 94.2
        var criticalAlerts = 8
        var monthlyRevenue = 12.4
    }
    
    init() {
        loadSampleData()
    }
    
    func refreshData() async {
        // Simulate network delay
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        
        // Update metrics with random variations
        await MainActor.run {
            metrics.totalContainers += Int.random(in: -1000...2000)
            metrics.activeShipments += Int.random(in: -500...1000)
            metrics.onTimeDelivery = Double.random(in: 92...96)
            metrics.criticalAlerts = Int.random(in: 5...15)
            metrics.monthlyRevenue = Double.random(in: 11...14)
        }
    }
    
    private func loadSampleData() {
        containers = [
            Container(
                id: "MSKU1234567",
                status: .inTransit,
                location: CLLocationCoordinate2D(latitude: 37.4419, longitude: -122.1430),
                destination: "Los Angeles Port",
                eta: "Jan 15, 2:30 PM",
                lastUpdate: "5 mins ago",
                delay: nil
            ),
            Container(
                id: "HLCU8765432",
                status: .atPort,
                location: CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437),
                destination: "Chicago Terminal",
                eta: "Jan 18, 9:00 AM",
                lastUpdate: "1 hour ago",
                delay: nil
            ),
            Container(
                id: "CMAU3456789",
                status: .delayed,
                location: CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
                destination: "Newark Port",
                eta: "Jan 16, 11:00 AM",
                lastUpdate: "30 mins ago",
                delay: "4 hours"
            )
        ]
        
        recentContainers = Array(containers.prefix(5))
    }
}

// MARK: - Authentication Manager
class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false
    private let context = LAContext()
    
    func authenticate() {
        var error: NSError?
        
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            let reason = "Authenticate to access ROOTUIP"
            
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authError in
                DispatchQueue.main.async {
                    if success {
                        self.isAuthenticated = true
                    } else {
                        // Handle error or fallback to password
                        print("Authentication failed: \(authError?.localizedDescription ?? "Unknown error")")
                    }
                }
            }
        } else {
            // Biometrics not available, use password
            isAuthenticated = true
        }
    }
}

// MARK: - Preview
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}