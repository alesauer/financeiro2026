@echo off
REM cria_estrutura_front.bat (estrutura vazia)
REM Cria apenas a estrutura básica de arquivos do frontend sem conteúdo.

echo Criando estrutura de frontend vazia...

REM Criação de pastas
if not exist "assets" mkdir assets
if not exist "assets\css" mkdir assets\css
if not exist "assets\js" mkdir assets\js
if not exist "assets\libs" mkdir assets\libs

REM Criação de arquivos vazios
type nul > index.html
type nul > categorias.html
type nul > transacoes.html
type nul > relatorios.html
type nul > assets\css\styles.css
type nul > assets\js\categorias.js
type nul > assets\js\transacoes.js
type nul > assets\js\relatorios.js
type nul > README_front.txt

echo Estrutura de frontend criada (arquivos vazios).
pause
