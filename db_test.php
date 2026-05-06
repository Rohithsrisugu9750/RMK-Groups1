<?php
// RMK Groups - PHP Database Diagnostic Test
header('Content-Type: text/html; charset=utf-8');

echo "<h2>RMK Groups - Database Connection Diagnostic</h2>";

$host = 'localhost';
$db   = 'masterbe_rmk_db';
$user = 'masterbe_rmk_user';
$pass = 'HP2YEUY5Es[(SJX#';

echo "<b>Attempting connection with credentials:</b><br>";
echo "Host: " . $host . "<br>";
echo "Database: " . $db . "<br>";
echo "User: " . $user . "<br>";
echo "Password: " . str_repeat("*", strlen($pass)) . "<br><br>";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<span style='color:green; font-weight:bold;'>✅ SUCCESS: Connected to MySQL successfully!</span><br><br>";
    
    // Check if table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'app_data'");
    $exists = $stmt->fetch();
    
    if ($exists) {
        echo "<span style='color:green; font-weight:bold;'>✅ SUCCESS: Table 'app_data' already exists.</span><br>";
        
        $stmt2 = $pdo->query("SELECT COUNT(*) FROM app_data");
        $count = $stmt2->fetchColumn();
        echo "<b>Current rows in database:</b> " . $count . "<br>";
    } else {
        echo "<span style='color:orange; font-weight:bold;'>⚠️ WARNING: Table 'app_data' does not exist yet. Attempting creation...</span><br>";
        
        $pdo->exec("CREATE TABLE app_data (
            data_key VARCHAR(255) PRIMARY KEY,
            data_value LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
        
        echo "<span style='color:green; font-weight:bold;'>✅ SUCCESS: Table 'app_data' created successfully!</span><br>";
    }
    
} catch (PDOException $e) {
    echo "<span style='color:red; font-weight:bold;'>❌ ERROR: Connection failed!</span><br><br>";
    echo "<b>Error Message:</b> <span style='color:red;'>" . htmlspecialchars($e->getMessage()) . "</span><br><br>";
    echo "<b>Recommendation:</b> Please double check your database username, password, and database name in cPanel / Hostinger MySQL databases section.";
}
?>
