function putConsulData
{
    curl -X PUT -d ${MYSQL_DATABASE} http://consul:8500/v1/kv/archive/db-init/database &&
    curl -X PUT -d 'root' http://consul:8500/v1/kv/archive/db-init/user &&
    curl -X PUT -d ${MYSQL_ROOT_PASSWORD} http://consul:8500/v1/kv/archive/db-init/password &&
    curl -X PUT -d 'true' http://consul:8500/v1/kv/archive/db-init/populate-test-data &&
    curl -X PUT -d ${REDIS_AUTH} http://consul:8500/v1/kv/archive/redis/password &&
    curl -X PUT -d ${RABBITMQ_USER} http://consul:8500/v1/kv/archive/mq/user &&
    curl -X PUT -d ${RABBITMQ_PASS} http://consul:8500/v1/kv/archive/mq/password
    curl -X PUT -d 'svc_archive' http://consul:8500/v1/kv/archive/service-client/username &&
    curl -X PUT -d 'test' http://consul:8500/v1/kv/archive/service-client/password &&
    curl -X PUT -d 'oidcCLIENT' http://consul:8500/v1/kv/archive/service-client/client-key &&
    curl -X PUT -d ${TOKEN_AUTH_CLIENT_SECRET_DEV} http://consul:8500/v1/kv/archive/service-client/client-secret
}

putConsulData

while [ $? -ne 0 ]; do
    sleep 1
    echo "Could not connect to consul. Retrying..."
    putConsulData
done

