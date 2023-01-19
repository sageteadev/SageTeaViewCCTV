# SageTeaViewCCTV 
### (GPLv3 + AGPLv3)

SageTeaViewCCTV is the Open Source CCTV Solution written in Node.JS Forked from Shinobi Systems https://gitlab.com/Shinobi-Systems/Shinobi by Moe Alam. Designed with multiple account system, Streams by WebSocket, and Save to WebM. SageTeaViewCCTV can record IP Cameras and Local Cameras.

## How to run

- Pull Image:

```console
docker pull sagetea/sageteaviewcctv:dev
```

- Run:

```console
docker run -d --restart unless-stopped --name='SageTeaViewCCTV' -p '8080:8080/tcp' -v "/dev/shm/SageTeaViewCCTV/streams":'/dev/shm/streams':'rw' -v "$HOME/SageTeaViewCCTV/config":'/config':'rw' -v "$HOME/SageTeaViewCCTV/customAutoLoad":'/home/SageTeaViewCCTV/libs/customAutoLoad':'rw' -v "$HOME/SageTeaViewCCTV/database":'/var/lib/mysql':'rw' -v "$HOME/SageTeaViewCCTV/videos":'/home/SageTeaViewCCTV/videos':'rw' -v "$HOME/SageTeaViewCCTV/plugins":'/home/SageTeaViewCCTV/plugins':'rw' -v '/etc/localtime':'/etc/localtime':'ro' sagetea/sageteaviewcctv:dev
```