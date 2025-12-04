@echo off
setlocal

:: Nome do projeto
:: set PROJECT=gestao_financeira
:: Criar diretórios
::mkdir %PROJECT%
::cd %PROJECT%

mkdir app
mkdir migrations

:: Criar arquivos básicos
echo. > run.py
echo. > requirements.txt

cd app
echo. > __init__.py
echo. > models.py
echo. > routes.py
echo. > schemas.py
echo. > config.py

cd ..
echo Projeto %PROJECT% criado com sucesso!
endlocal
pause
