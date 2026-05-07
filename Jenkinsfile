pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Stop Existing Containers') {
            steps {
                sh 'docker compose -p anonymous-confession-wall down'
            }
        }

        stage('Build & Deploy') {
            steps { 
                sh 'docker compose -p anonymous-confession-wall up -d --build'
            }
        }

        stage('Verify Deployment') {
            steps {
                sh 'docker compose -p anonymous-confession-wall ps'
            }
        }
    }
}