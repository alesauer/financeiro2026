CREATE DATABASE gestao_financeira CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'usuario'@'localhost' IDENTIFIED BY 'senha';
GRANT ALL PRIVILEGES ON gestao_financeira.* TO 'usuario'@'localhost';
FLUSH PRIVILEGES;