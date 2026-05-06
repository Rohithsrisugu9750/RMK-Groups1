<?php
// RMK Groups - PHP Database Sync (Hostinger)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$host = 'localhost';
$db   = 'masterbe_rmk_db';
$user = 'masterbe_rmk_user';
$pass = 'HP2YEUY5Es[(SJX#';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec("CREATE TABLE IF NOT EXISTS app_data (
        data_key VARCHAR(255) PRIMARY KEY,
        data_value LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query("SELECT data_key, data_value FROM app_data");
        echo json_encode($stmt->fetchAll(PDO::FETCH_KEY_PAIR));
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['key'], $input['value'])) {
            $stmt = $pdo->prepare("INSERT INTO app_data (data_key, data_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE data_value = ?");
            $stmt->execute([$input['key'], $input['value'], $input['value']]);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Missing key or value']);
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error', 'msg' => $e->getMessage()]);
}
?>
