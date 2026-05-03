<?php
// =====================================================================
// /api/auth.php — Signup, Login, Logout, Me
// Routing: ?action=signup | login | logout | me
// =====================================================================

declare(strict_types=1);
require_once __DIR__ . '/../config/helpers.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'signup':  handle_signup();  break;
        case 'login':   handle_login();   break;
        case 'logout':  handle_logout();  break;
        case 'me':      handle_me();      break;
        default:        json_error('Unknown action', 404);
    }
} catch (Throwable $e) {
    json_error($e->getMessage(), 500);
}

function handle_signup(): void {
    $body = read_json_body();
    $email     = trim((string)($body['email']      ?? ''));
    $password  = (string)($body['password']        ?? '');
    $fullName  = trim((string)($body['full_name']  ?? ''));
    $studentId = trim((string)($body['student_id'] ?? ''));

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Valid email required');
    if (strlen($password) < 8) json_error('Password must be at least 8 characters');
    if ($fullName === '') json_error('Full name required');

    $pdo = db();
    $exists = $pdo->prepare('SELECT 1 FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) json_error('Email already registered', 409);

    $userId = uuid_v4();
    $hash   = password_hash($password, PASSWORD_BCRYPT);

    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
            ->execute([$userId, $email, $hash]);

        $pdo->prepare('INSERT INTO profiles (id, full_name, email, student_id) VALUES (?, ?, ?, ?)')
            ->execute([$userId, $fullName, $email, $studentId !== '' ? $studentId : null]);

        // All new self-signups are students by default.
        $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)')
            ->execute([uuid_v4(), $userId, 'student']);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    set_session($userId, $email, 'student', null);
    json_response(['success' => true, 'user' => current_user()]);
}

function handle_login(): void {
    $body = read_json_body();
    $email    = trim((string)($body['email']    ?? ''));
    $password = (string)($body['password'] ?? '');

    $stmt = db()->prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($password, $row['password_hash'])) {
        json_error('Invalid email or password', 401);
    }

    // Pick best role (master_admin > dept_admin > student)
    $r = db()->prepare(
        "SELECT role, department_id FROM user_roles
         WHERE user_id = ?
         ORDER BY FIELD(role, 'master_admin','dept_admin','student')
         LIMIT 1"
    );
    $r->execute([$row['id']]);
    $role = $r->fetch() ?: ['role' => 'student', 'department_id' => null];

    set_session($row['id'], $row['email'], $role['role'], $role['department_id']);
    json_response(['success' => true, 'user' => current_user()]);
}

function handle_logout(): void {
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    json_response(['success' => true]);
}

function handle_me(): void {
    $u = current_user();
    if (!$u) json_response(['user' => null]);

    $p = db()->prepare('SELECT id, full_name, email, student_id, course, batch FROM profiles WHERE id = ?');
    $p->execute([$u['id']]);
    json_response(['user' => $u, 'profile' => $p->fetch() ?: null]);
}

function set_session(string $id, string $email, string $role, ?string $deptId): void {
    start_session();
    session_regenerate_id(true);
    $_SESSION['user_id']       = $id;
    $_SESSION['email']         = $email;
    $_SESSION['role']          = $role;
    $_SESSION['department_id'] = $deptId;
}
