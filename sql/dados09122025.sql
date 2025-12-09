-- MySQL dump 10.13  Distrib 8.0.38, for Win64 (x86_64)
--
-- Host: localhost    Database: gestao_financeira
-- ------------------------------------------------------
-- Server version	8.0.39

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alembic_version`
--

DROP TABLE IF EXISTS `alembic_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alembic_version`
--

LOCK TABLES `alembic_version` WRITE;
/*!40000 ALTER TABLE `alembic_version` DISABLE KEYS */;
/*!40000 ALTER TABLE `alembic_version` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` enum('Receita','Despesa','Investimento') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (4,'Habitação','Receita'),(5,'Alimentação','Despesa'),(6,'Transporte','Despesa'),(7,'Moradia','Despesa'),(8,'Saúde','Despesa'),(9,'Lazer','Despesa'),(10,'Educação','Despesa'),(11,'Outros','Despesa'),(12,'Renda Fixa','Investimento'),(13,'Ações','Investimento'),(14,'Fundos Imobiliários','Investimento'),(15,'Criptomoedas','Investimento'),(16,'Tesouro Direto','Investimento'),(17,'Outros','Investimento'),(18,'Transporte','Despesa'),(39,'Salario Mensal','Receita'),(40,'OFFHUNTER','Receita');
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transacoes`
--

DROP TABLE IF EXISTS `transacoes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transacoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo` enum('Receita','Despesa','Investimento') COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoria_id` int NOT NULL,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `data_transacao` date NOT NULL,
  `forma_pagamento` enum('Dinheiro','Cartão de Crédito','Cartão de Débito','Pix','Boleto','Transferência') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Pago','Pendente') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recorrente` tinyint(1) DEFAULT NULL,
  `frequencia` enum('Diária','Semanal','Mensal','Anual') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data_fim` date DEFAULT NULL,
  `parcelado` tinyint(1) DEFAULT NULL,
  `total_parcelas` int DEFAULT NULL,
  `parcela_atual` int DEFAULT NULL,
  `valor_parcela` decimal(10,2) DEFAULT NULL,
  `observacoes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `transacoes_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transacoes`
--

LOCK TABLES `transacoes` WRITE;
/*!40000 ALTER TABLE `transacoes` DISABLE KEYS */;
INSERT INTO `transacoes` VALUES (4,'Despesa',6,'Uber para reunião',600.00,'2025-12-02','Pix','Pago',0,NULL,NULL,0,NULL,1,NULL,NULL),(5,'Despesa',7,'Aluguel Setembro',150.00,'2025-12-01','Cartão de Crédito','Pago',1,NULL,NULL,0,NULL,1,NULL,NULL),(6,'Despesa',8,'Consulta médica',350.00,'2025-12-03','Cartão de Crédito','Pago',0,NULL,NULL,0,3,1,0.00,NULL),(20,'Receita',40,'teste',10000.00,'2025-12-15','Transferência','Pago',0,NULL,NULL,0,NULL,1,NULL,NULL),(24,'Receita',39,'Salário ALMG',1000.00,'2025-12-05','Transferência','Pago',1,'Mensal','2026-02-06',0,NULL,1,NULL,NULL),(25,'Receita',39,'Salário ALMG',1000.00,'2026-01-05','Transferência','Pago',1,'Mensal','2026-02-06',0,NULL,1,NULL,NULL),(26,'Receita',39,'Salário ALMG',1000.00,'2026-02-05','Transferência','Pago',1,'Mensal','2026-02-06',0,NULL,1,NULL,NULL);
/*!40000 ALTER TABLE `transacoes` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-09 16:58:46
