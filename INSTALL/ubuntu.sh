#!/bin/bash
echo "========================================================="
echo "==!! SageTeaViewCCTV : CCTV and NVR Solution !!=="
echo "========================================================="
echo "To answer yes type the letter (y) in lowercase and press ENTER."
echo "Default is no (N). Skip any components you already have or don't need."
echo "============="
#Detect Ubuntu Version
echo "============="
echo " Detecting Ubuntu Version"
echo "============="
getubuntuversion=$(lsb_release -r | awk '{print $2}' | cut -d . -f1)
echo "============="
echo " Ubuntu Version: $getubuntuversion"
echo "============="
if [ "$getubuntuversion" = "18" ] || [ "$getubuntuversion" > "18" ]; then
    apt install sudo wget -y
    sudo apt install -y software-properties-common
    sudo add-apt-repository universe -y
fi
#create conf.json
if [ ! -e "./conf.json" ]; then
    sudo cp conf.sample.json conf.json
fi
#create super.json
if [ ! -e "./super.json" ]; then
    echo "============="
    echo "Default Superuser : admin@sagetea.video"
    echo "Default Password : admin"
    echo "* You can edit these settings in \"super.json\" located in the Shinobi directory."
    sudo cp super.sample.json super.json
fi
if ! [ -x "$(command -v ifconfig)" ]; then
    echo "============="
    echo "SageTeaViewCCTV - Installing Net-Tools"
    sudo apt install net-tools -y
fi
if ! [ -x "$(command -v node)" ]; then
    echo "============="
    echo "SageTeaViewCCTV - Installing Node.js"
    wget https://deb.nodesource.com/setup_8.x
    chmod +x setup_8.x
    ./setup_8.x
    sudo apt install nodejs -y
else
    echo "Node.js Found..."
    echo "Version : $(node -v)"
fi
if ! [ -x "$(command -v npm)" ]; then
    sudo apt install npm -y
fi
sudo apt install make zip -y
if ! [ -x "$(command -v ffmpeg)" ]; then
    if [ "$getubuntuversion" = "16" ] || [ "$getubuntuversion" < "16" ]; then
        echo "============="
        echo "SageTeaViewCCTV - Get FFMPEG 3.x from ppa:jonathonf/ffmpeg-3"
        sudo add-apt-repository ppa:jonathonf/ffmpeg-3 -y
        sudo apt update -y && sudo apt install ffmpeg libav-tools x264 x265 -y
    else
        echo "============="
        echo "SageTeaViewCCTV - Installing FFMPEG"
        sudo apt install ffmpeg -y
    fi
else
    echo "FFmpeg Found..."
    echo "Version : $(ffmpeg -version)"
fi
echo "============="
echo "SageTeaViewCCTV - Do you want to use MariaDB or SQLite3?"
echo "SQLite3 is better for small installs"
echo "MariaDB (MySQL) is better for large installs"
echo "(S)QLite3 or (M)ariaDB?"
echo "Press [ENTER] for default (MariaDB)"
read sqliteormariadb
if [ "$sqliteormariadb" = "S" ] || [ "$sqliteormariadb" = "s" ]; then
    sudo npm install jsonfile
    sudo apt-get install sqlite3 libsqlite3-dev -y
    sudo npm install sqlite3
    node ./tools/modifyConfiguration.js databaseType=sqlite3
    if [ ! -e "./sageteaviewcctv.sqlite" ]; then
        echo "Creating sageteaviewcctv.sqlite for SQLite3..."
        sudo cp sql/shinobi.sample.sqlite sageteaviewcctv.sqlite
    else
        echo "sageteaviewcctv.sqlite already exists. Continuing..."
    fi
else
    echo "SageTeaViewCCTV - Do you want to Install MariaDB? Choose No if you already have it."
    echo "(y)es or (N)o"
    read mysqlagree
    if [ "$mysqlagree" = "y" ] || [ "$mysqlagree" = "Y" ]; then
        echo "SageTeaViewCCTV - Installing MariaDB"
        echo "Password for root SQL user, If you are installing SQL now then you may put anything:"
        read sqlpass
        echo "mariadb-server mariadb-server/root_password password $sqlpass" | debconf-set-selections
        echo "mariadb-server mariadb-server/root_password_again password $sqlpass" | debconf-set-selections
        sudo apt install mariadb-server -y
        sudo service mysql start
    fi
    echo "============="
    echo "SageTeaViewCCTV - Database Installation"
    echo "(y)es or (N)o"
    read mysqlagreeData
    if [ "$mysqlagreeData" = "y" ] || [ "$mysqlagreeData" = "Y" ]; then
        if [ "$mysqlagree" = "y" ] || [ "$mysqlagree" = "Y" ]; then
            sqluser="root"
        fi
        if [ ! "$mysqlagree" = "y" ]; then
            echo "What is your SQL Username?"
            read sqluser
            echo "What is your SQL Password?"
            read sqlpass
        fi
        sudo mysql -u $sqluser -p$sqlpass -e "source sql/user.sql" || true
        sudo mysql -u $sqluser -p$sqlpass -e "source sql/framework.sql" || true
    fi
fi
echo "============="
echo "SageTeaViewCCTV - Install NPM Libraries"
sudo npm i npm -g
sudo npm install --unsafe-perm
sudo npm audit fix --force
echo "============="
echo "SageTeaViewCCTV - Install PM2"
sudo npm install pm2 -g
echo "SageTeaViewCCTV - Finished"
sudo chmod -R 755 .
touch INSTALL/installed.txt
dos2unix /home/SageTeaViewCCTV/INSTALL/sageteaviewcctv
ln -s /home/SageTeaViewCCTV/INSTALL/sageteaviewcctv /usr/bin/sageteaviewcctv
echo "SageTeaViewCCTV - Start SageTeaViewCCTV and set to start on boot?"
echo "(y)es or (N)o"
read startSageTeaViewCCTV
if [ "$SageTeaViewCCTV" = "y" ] || [ "$SageTeaViewCCTV" = "y" ]; then
    sudo pm2 start camera.js
    sudo pm2 start cron.js
    sudo pm2 startup
    sudo pm2 save
    sudo pm2 list
fi
echo "====================================="
echo "||=====   Install Completed   =====||"
echo "====================================="
echo "|| Login with the Superuser and create a new user!!"
echo "||==================================="
echo "|| Open http://$(ifconfig | sed -En 's/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p'):8080/super in your web browser."
echo "||==================================="
echo "|| Default Superuser : admin@sagetea.video"
echo "|| Default Password : admin"
echo "====================================="
echo "====================================="
