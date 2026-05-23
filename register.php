<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!validate_csrf_token($_POST['csrf_token'])) {
        die('Invalid CSRF token.');
    }

    $username = trim($_POST['username']);
    $password = $_POST['password'];

    // Input validation
    if (empty($username) || empty($password) || strlen($password) < 8 || !preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        die('Invalid input.');
    }

    // Check if username exists
    $pdo = get_db_connection();
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = :username");
    $stmt->execute(['username' => $username]);
    if ($stmt->fetch()) {
        die('Username already taken.');
    }

    // Hash password with bcrypt
    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    // Insert user with prepared statement (anti-SQL injection)
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (:username, :password_hash)");
    $stmt->execute(['username' => $username, 'password_hash' => $password_hash]);

    echo 'Registration successful. <a href="auth.html">Login</a>';
} else {
    header('Location: auth.html');
}
?>