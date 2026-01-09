@echo off
cd /d "D:\Bot"
pm2 start app.js --name bot
exit
