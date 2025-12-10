-- MySQL dump 10.13  Distrib 8.0.39, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: gestao_financeira
-- ------------------------------------------------------
-- Server version	8.0.39

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
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

/*!40000 ALTER TABLE `alembic_version` DISABLE KEYS */;
/*!40000 ALTER TABLE `alembic_version` ENABLE KEYS */;

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
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (4,'Férias Prêmio','Receita'),(5,'Alimentação','Despesa'),(6,'Transporte','Despesa'),(7,'Moradia','Despesa'),(8,'Saúde','Despesa'),(9,'Lazer','Despesa'),(10,'Educação','Despesa'),(11,'Outros','Despesa'),(12,'Renda Fixa','Investimento'),(13,'Ações','Investimento'),(14,'Fundos Imobiliários','Investimento'),(15,'Criptomoedas','Investimento'),(16,'Tesouro Direto','Investimento'),(17,'Outros','Investimento'),(18,'Transporte','Despesa'),(39,'Salario Mensal','Receita'),(40,'OFFHUNTER','Receita'),(41,'Aluguel','Receita');
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;

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
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transacoes`
--

/*!40000 ALTER TABLE `transacoes` DISABLE KEYS */;
INSERT INTO `transacoes` VALUES (34,'Receita',39,'Salário ALMG',16649.00,'2026-01-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(35,'Receita',39,'Salário ALMG',16649.00,'2026-02-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(36,'Receita',39,'Salário ALMG',16649.00,'2026-03-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(37,'Receita',39,'Salário ALMG',16649.00,'2026-04-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(38,'Receita',39,'Salário ALMG',16649.00,'2026-05-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(39,'Receita',39,'Salário ALMG',16649.00,'2026-06-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(40,'Receita',39,'Salário ALMG',16649.00,'2026-07-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(41,'Receita',39,'Salário ALMG',16649.00,'2026-08-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(42,'Receita',39,'Salário ALMG',16649.00,'2026-09-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(43,'Receita',39,'Salário ALMG',16649.00,'2026-10-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(44,'Receita',39,'Salário ALMG',16649.00,'2026-11-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(45,'Receita',39,'Salário ALMG',16649.00,'2026-12-01','Transferência','Pendente',1,'Mensal','2027-01-01',0,NULL,1,NULL,NULL),(47,'Receita',39,'Salário OffHunter',4200.00,'2026-01-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(48,'Receita',39,'Salário OffHunter',4200.00,'2026-02-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(49,'Receita',39,'Salário OffHunter',4200.00,'2026-03-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(50,'Receita',39,'Salário OffHunter',4200.00,'2026-04-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(51,'Receita',39,'Salário OffHunter',4200.00,'2026-05-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(52,'Receita',39,'Salário OffHunter',4200.00,'2026-06-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(53,'Receita',39,'Salário OffHunter',4200.00,'2026-07-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(54,'Receita',39,'Salário OffHunter',4200.00,'2026-08-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(55,'Receita',39,'Salário OffHunter',4200.00,'2026-09-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(56,'Receita',39,'Salário OffHunter',4200.00,'2026-10-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(57,'Receita',39,'Salário OffHunter',4200.00,'2026-11-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(58,'Receita',39,'Salário OffHunter',4200.00,'2026-12-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(59,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-01-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(60,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-02-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(61,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-03-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(62,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-04-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(63,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-05-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(64,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-06-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(65,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-07-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(66,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-08-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(67,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-09-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(68,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-10-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(69,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-11-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(70,'Receita',4,'ALMG Férias Prêmio',2683.00,'2026-12-15','Transferência','Pendente',1,'Mensal','2026-12-15',0,NULL,1,NULL,NULL),(71,'Receita',41,'Alguel Progresso',818.00,'2026-01-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(72,'Receita',41,'Alguel Progresso',818.00,'2026-02-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(73,'Receita',41,'Alguel Progresso',818.00,'2026-03-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(74,'Receita',41,'Alguel Progresso',818.00,'2026-04-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(75,'Receita',41,'Alguel Progresso',818.00,'2026-05-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(76,'Receita',41,'Alguel Progresso',818.00,'2026-06-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(77,'Receita',41,'Alguel Progresso',818.00,'2026-07-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(78,'Receita',41,'Alguel Progresso',818.00,'2026-08-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(79,'Receita',41,'Alguel Progresso',818.00,'2026-09-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(80,'Receita',41,'Alguel Progresso',818.00,'2026-10-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(81,'Receita',41,'Alguel Progresso',818.00,'2026-11-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL),(82,'Receita',41,'Alguel Progresso',818.00,'2026-12-10','Transferência','Pendente',1,'Mensal','2026-12-10',0,NULL,1,NULL,NULL);
/*!40000 ALTER TABLE `transacoes` ENABLE KEYS */;

--
-- Dumping routines for database 'gestao_financeira'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-10 19:26:36
