@echo off
echo Starting all services...

:: Start API Gateway
cd ..
cd api-gateway
start "API-GW" npm run dev
cd ..

:: Start Frontend
cd frontend
start "Frontend" npx serve -l 5000
cd ..

:: Start Service 1
cd course-service
start "CourseSvc" npm run dev
cd ..

:: Start Service 2
cd enrollment-service
start "EnrollmentSvc" npm run dev
cd ..

:: Start Service 3
cd notification-service
start "NotificationSvc" npm run dev
cd ..

:: Start Service 4
cd progress-service
start "ProgressSvc" npm run dev
cd ..

:: Start Service 5
cd user-service
start "UserSvc" npm run dev
cd ..
cd scripts

echo All services started!
echo API Gateway: http://localhost:3000
echo Frontend: http://localhost:5000
echo User Service: http://localhost:3001
echo Course Service: http://localhost:3002
echo Enrollment Service: http://localhost:3003
echo Progress Service: http://localhost:3004
echo Notification Service: http://localhost:3005
pause