# <p style="text-align: center;">SageTeaViewCCTV</p>

<div align="center">
    <img src="/web/libs/img/icon/mstile-144x144.png">
</div>

___________________________________________________________
# <p style="text-align: center;">License</p>

### <p style="text-align: center;">GPLv3 + AGPLv3</p>

<p style="text-align: center;">SageTeaViewCCTV is the Open Source CCTV Solution written in Node.JS Forked from Shinobi Systems https://gitlab.com/Shinobi-Systems/Shinobi by Moe Alam. Designed with multiple account system, Streams by WebSocket, and Save to WebM. SageTeaViewCCTV can record IP Cameras and Local Cameras.</p>

- First time setup
open brownser on YOUR_IP:8080/super

Default login: admin@sagetea.cctv
Dafault Password: admin

- Create a user and credentials an logout.
- YOUR_IP:8080 to login with new account created
## How to run

- Pull Image:

```console
docker pull sagetea/sageteaviewcctv:dev
```

- Run:

```console
docker run -d --restart unless-stopped --name='SageTeaViewCCTV' -p '8080:8080/tcp' -v "/dev/shm/SageTeaViewCCTV/streams":'/dev/shm/streams':'rw' -v "$HOME/SageTeaViewCCTV/config":'/config':'rw' -v "$HOME/SageTeaViewCCTV/customAutoLoad":'/home/SageTeaViewCCTV/libs/customAutoLoad':'rw' -v "$HOME/SageTeaViewCCTV/database":'/var/lib/mysql':'rw' -v "$HOME/SageTeaViewCCTV/videos":'/home/SageTeaViewCCTV/videos':'rw' -v "$HOME/SageTeaViewCCTV/plugins":'/home/SageTeaViewCCTV/plugins':'rw' -v '/etc/localtime':'/etc/localtime':'ro' sagetea/sageteaviewcctv:dev
```

- XFone

```console
docker run -d --restart unless-stopped --name='SageTeaViewCCTV' -p '8080:8080/tcp' -v "/dev/shm/SageTeaViewCCTV/streams":'/dev/shm/streams':'rw' -v "$HOME/phablet/SageTeaViewCCTV/config":'/config':'rw' -v "$HOME/phablet/SageTeaViewCCTV/customAutoLoad":'/home/phablet/SageTeaViewCCTV/libs/customAutoLoad':'rw' -v "$HOME/phablet/SageTeaViewCCTV/database":'/var/lib/mysql':'rw' -v "$HOME/phablet/SageTeaViewCCTV/videos":'/home/SageTeaViewCCTV/videos':'rw' -v "$HOME/phablet/SageTeaViewCCTV/plugins":'/home/SageTeaViewCCTV/plugins':'rw' -v '/etc/localtime':'/etc/localtime':'ro' sagetea/sageteaviewcctv:dev
```