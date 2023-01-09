# SageTeaView CCTV 
### (GPLv3 + AGPLv3)

SageTeaView CCTV is the Open Source CCTV Solution written in Node.JS Forked from Shinobi CE project Shinobi Systems. Designed with multiple account system, Streams by WebSocket, and Save to WebM. Shinobi can record IP Cameras and Local Cameras.

docker run -d sagetea/sageteaviewcctv:latest -p '8080:8080/tcp' -v "/dev/shm/SageTeaViewCCTV/streams":'/dev/shm/streams':'rw' -v "$HOME/SageTeaViewCCTV/config":'/config':'rw' -v "$HOME/SageTeaViewCCTV/customAutoLoad":'/home/SageTeaViewCCTV/libs/customAutoLoad':'rw' -v "$HOME/SageTeaViewCCTV/database":'/var/lib/mysql':'rw' -v "$HOME/SageTeaViewCCTV/videos":'/home/SageTeaViewCCTV/videos':'rw' -v "$HOME/SageTeaViewCCTV/plugins":'/home/SageTeaViewCCTV/plugins':'rw' -v '/etc/localtime':'/etc/localtime':'ro' registry.github.com/SageTeaViewCCTV/sageteaviewcctv:latest