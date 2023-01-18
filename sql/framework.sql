-- --------------------------------------------------------
-- Host:                         172.16.100.238
-- Server version:               10.3.25-MariaDB-0ubuntu0.20.04.1 - Ubuntu 20.04
-- Server OS:                    debian-linux-gnu
-- HeidiSQL Version:             11.0.0.5919
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;


-- Dumping database structure for ccio
CREATE DATABASE IF NOT EXISTS `ccio` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;
USE `ccio`;

-- Dumping structure for table ccio.API
CREATE TABLE IF NOT EXISTS `API` (
  `ke` varchar(50) DEFAULT NULL,
  `uid` varchar(50) DEFAULT NULL,
  `ip` tinytext DEFAULT NULL,
  `code` varchar(100) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `time` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Cloud Timelapse Frames
CREATE TABLE IF NOT EXISTS `Cloud Timelapse Frames` (
  `ke` varchar(50) NOT NULL,
  `mid` varchar(50) NOT NULL,
  `href` text NOT NULL,
  `details` longtext DEFAULT NULL,
  `filename` varchar(50) NOT NULL,
  `time` timestamp NULL DEFAULT NULL,
  `size` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Cloud Videos
CREATE TABLE IF NOT EXISTS `Cloud Videos` (
  `mid` varchar(50) NOT NULL,
  `ke` varchar(50) DEFAULT NULL,
  `href` text NOT NULL,
  `size` float DEFAULT NULL,
  `time` timestamp NULL DEFAULT NULL,
  `end` timestamp NULL DEFAULT NULL,
  `status` int(1) DEFAULT 0 COMMENT '0:Complete,1:Read,2:Archive',
  `details` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Events
CREATE TABLE IF NOT EXISTS `Events` (
  `ke` varchar(50) DEFAULT NULL,
  `mid` varchar(50) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  KEY `events_index` (`ke`,`mid`,`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Events Counts
CREATE TABLE IF NOT EXISTS `Events Counts` (
  `ke` varchar(50) NOT NULL,
  `mid` varchar(50) NOT NULL,
  `details` longtext NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp(),
  `end` timestamp NOT NULL DEFAULT current_timestamp(),
  `count` int(10) NOT NULL DEFAULT 1,
  `tag` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Files
CREATE TABLE IF NOT EXISTS `Files` (
  `ke` varchar(50) NOT NULL,
  `mid` varchar(50) NOT NULL,
  `name` tinytext NOT NULL,
  `size` float NOT NULL DEFAULT 0,
  `details` text NOT NULL,
  `status` int(1) NOT NULL DEFAULT 0,
  `time` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.LoginTokens
CREATE TABLE IF NOT EXISTS `LoginTokens` (
  `loginId` varchar(255) DEFAULT '',
  `type` varchar(25) DEFAULT '',
  `ke` varchar(50) DEFAULT '',
  `uid` varchar(50) DEFAULT '',
  `name` varchar(50) DEFAULT 'Unknown',
  `lastLogin` timestamp NOT NULL DEFAULT current_timestamp(),
  UNIQUE KEY `logintokens_loginid_unique` (`loginId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Logs
CREATE TABLE IF NOT EXISTS `Logs` (
  `ke` varchar(50) DEFAULT NULL,
  `mid` varchar(50) DEFAULT NULL,
  `info` text DEFAULT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  KEY `logs_index` (`ke`,`mid`,`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Monitors
CREATE TABLE IF NOT EXISTS `Monitors` (
  `mid` varchar(50) DEFAULT NULL,
  `ke` varchar(50) DEFAULT NULL,
  `name` varchar(50) DEFAULT NULL,
  `shto` text DEFAULT NULL,
  `shfr` text DEFAULT NULL,
  `details` longtext DEFAULT NULL,
  `type` varchar(50) DEFAULT 'jpeg',
  `ext` varchar(50) DEFAULT 'webm',
  `protocol` varchar(50) DEFAULT 'http',
  `host` varchar(100) DEFAULT '0.0.0.0',
  `path` varchar(100) DEFAULT '/',
  `port` int(8) DEFAULT 80,
  `fps` int(8) DEFAULT 1,
  `mode` varchar(15) DEFAULT NULL,
  `width` int(11) DEFAULT 640,
  `height` int(11) DEFAULT 360,
  KEY `monitors_index` (`ke`,`mode`,`type`,`ext`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Presets
CREATE TABLE IF NOT EXISTS `Presets` (
  `ke` varchar(50) DEFAULT NULL,
  `name` text DEFAULT NULL,
  `details` text DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Schedules
CREATE TABLE IF NOT EXISTS `Schedules` (
  `ke` varchar(50) DEFAULT NULL,
  `name` text DEFAULT NULL,
  `details` text DEFAULT NULL,
  `start` varchar(10) DEFAULT NULL,
  `end` varchar(10) DEFAULT NULL,
  `enabled` int(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Timelapse Frames
CREATE TABLE IF NOT EXISTS `Timelapse Frames` (
  `ke` varchar(50) NOT NULL,
  `mid` varchar(50) NOT NULL,
  `details` longtext DEFAULT NULL,
  `filename` varchar(50) NOT NULL,
  `time` timestamp NULL DEFAULT NULL,
  `size` int(11) NOT NULL,
  KEY `timelapseframes_index` (`ke`,`mid`,`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Timelapses
CREATE TABLE IF NOT EXISTS `Timelapses` (
  `ke` varchar(50) NOT NULL,
  `mid` varchar(50) NOT NULL,
  `details` longtext DEFAULT NULL,
  `date` date NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `end` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `size` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Users
CREATE TABLE IF NOT EXISTS `Users` (
  `ke` varchar(50) DEFAULT NULL,
  `uid` varchar(50) DEFAULT NULL,
  `auth` varchar(50) DEFAULT NULL,
  `mail` varchar(100) DEFAULT NULL,
  `pass` varchar(100) DEFAULT NULL,
  `accountType` int(1) DEFAULT 0,
  `details` longtext DEFAULT NULL,
  UNIQUE KEY `mail` (`mail`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

-- Dumping structure for table ccio.Videos
CREATE TABLE IF NOT EXISTS `Videos` (
  `mid` varchar(50) DEFAULT NULL,
  `ke` varchar(50) DEFAULT NULL,
  `ext` enum('webm','mp4') DEFAULT NULL,
  `time` timestamp NULL DEFAULT NULL,
  `duration` float DEFAULT NULL,
  `size` float DEFAULT NULL,
  `frames` int(11) DEFAULT NULL,
  `end` timestamp NULL DEFAULT NULL,
  `status` int(1) DEFAULT 0,
  `archived` int(1) DEFAULT 0,
  `details` text DEFAULT NULL,
  KEY `videos_index` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
