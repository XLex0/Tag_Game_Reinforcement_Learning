function srv = inference_server_police()
    % === Cargar agente ===
    S = load('../agents_police/agent_police_0.mat');
    agent = S.agentPolice;

    % === Servidor TCP ===
    port = 7778;
    srv = tcpserver('127.0.0.1', port, 'ConnectionChangedFcn', @onConn);
    configureTerminator(srv,"LF");

    % REGISTRO DEL CALLBACK (nuevo API primero)
    try
        % Releases nuevos usan configureCallback
        configureCallback(srv, "terminator", @(src,evt) onData(src, agent));
    catch
        % Solo si tuvieras un release antiguo:
        srv.BytesAvailableFcnMode = "terminator";
        srv.BytesAvailableFcn     = @(src,evt) onData(src, agent);
    end

    fprintf('POLICE AI server listo en tcp://127.0.0.1:%d\n', port);
    fprintf('Guarda la variable "srv" viva. Para detener: delete(srv); clear srv\n');
end

function onConn(srv, ~)
    if srv.Connected
        fprintf('[MATLAB] Cliente conectado.\n');
    else
        fprintf('[MATLAB] Cliente desconectado.\n');
    end
end

function onData(srv, agent)
    % Guarda G en UserData para no mandarlo siempre
    if ~isfield(srv.UserData,'G'); srv.UserData.G = 15; end

    try
        line = readline(srv);
        msg  = jsondecode(char(line));

        if isfield(msg,'cmd') && strcmp(msg.cmd,'init') && isfield(msg,'G')
            srv.UserData.G = double(msg.G);
            writeline(srv, '{"ok":true}');
            return
        end

        if isfield(msg,'cmd') && strcmp(msg.cmd,'act') && (isfield(msg,'pos') || isfield(msg,'obs'))
            % 1) extraer posiciones crudas
            if isfield(msg,'pos'), v = double(msg.pos(:)); else, v = double(msg.obs(:)); end
            if numel(v) < 6, writeline(srv,'{"error":"badshape"}'); return; end
            tx=v(1); ty=v(2); p0x=v(3); p0y=v(4); p1x=v(5); p1y=v(6);

            % 2) G (del mensaje o cacheado)
            if isfield(msg,'G') && ~isempty(msg.G)
                G = double(msg.G);
                srv.UserData.G = G;
            else
                G = srv.UserData.G;
            end

            % 3) distancias y normalización (igual que entrenamiento)
            d0 = hypot(p0x - tx, p0y - ty);
            d1 = hypot(p1x - tx, p1y - ty);
            obs = single([tx/G; ty/G; p0x/G; p0y/G; p1x/G; p1y/G; d0/(sqrt(2)*G); d1/(sqrt(2)*G)]);
            obsIn = {obs};                            % cell, [8x1], single

            % 4) acción greedy
            agent.UseExplorationPolicy = false;
            a = getAction(agent, obsIn); if iscell(a), a = a{1}; end

            out.aP0 = a(1,1:2); out.aP1 = a(1,3:4);
            writeline(srv, jsonencode(out));
        else
            writeline(srv, '{"error":"badmsg"}');
        end
    catch e
        warning(e.identifier, '%s', e.message);
        try, writeline(srv, '{"error":"server"}'); end
    end
end
