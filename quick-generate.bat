@echo off
setlocal enabledelayedexpansion
echo 🎙️  Multi-Agent Podcast Generator - Quick Start
echo.
echo Choose a podcast type:
echo 1^) Tech News ^(5 min^)
echo 2^) AI ^& Future ^(8 min^)
echo 3^) Business Trends ^(6 min^)
echo 4^) Science Discovery ^(10 min^)
echo 5^) Custom Topic
echo.

set /p choice="Enter choice (1-5): "

if "%choice%"=="1" (
    echo 🔧 Generating Tech News podcast...
    node generate-podcast.js --topic "Latest Technology Trends" --focus "AI, blockchain, and emerging technologies" --mood "excited" --duration 5 --chapters 3
) else if "%choice%"=="2" (
    echo 🤖 Generating AI ^& Future podcast...
    node generate-podcast.js --topic "The Future of Artificial Intelligence" --focus "Impact on society, jobs, and daily life" --mood "excited" --duration 8 --chapters 4
) else if "%choice%"=="3" (
    echo 💼 Generating Business Trends podcast...
    node generate-podcast.js --topic "Modern Business Innovation" --focus "Digital transformation and startup culture" --mood "neutral" --duration 6 --chapters 3
) else if "%choice%"=="4" (
    echo 🔬 Generating Science Discovery podcast...
    node generate-podcast.js --topic "Recent Scientific Breakthroughs" --focus "Space exploration, medicine, and climate science" --mood "reflective" --duration 10 --chapters 5
) else if "%choice%"=="5" (
    echo.
    set /p topic="Enter your topic: "
    set /p focus="Enter focus/angle: "
    set /p mood="Mood (excited, neutral, calm, reflective, enthusiastic): "
    set /p duration="Duration (minutes): "
    
    echo.
    echo 📝 Your selections:
    echo Topic: !topic!
    echo Focus: !focus!
    echo Mood: !mood!
    echo Duration: !duration! minutes
    echo.
    
    echo 🎯 Generating custom podcast...
    node generate-podcast.js --topic "!topic!" --focus "!focus!" --duration "!duration!" --mood "!mood!"
) else (
    echo ❌ Invalid choice. Please run again.
    pause
    exit /b 1
)

pause
