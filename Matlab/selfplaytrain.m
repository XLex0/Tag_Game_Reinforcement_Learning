function selfplaytrain(numCycles)
% selfplaytrain Entrenamiento iterativo Police <-> Thief con reintentos básicos.
%
%   selfplaytrain()        % usa numCycles = 10 por defecto
%   selfplaytrain(N)       % N ciclos Police+Thief

    if nargin < 1
        numCycles = 10;
    end

    for cyc = 1:numCycles
        fprintf('\n================ CICLO %d: ENTRENAR POLICE ==================\n', cyc);
        safeTrainScript('trainPolice.m','Police',cyc);

        fprintf('\n================ CICLO %d: ENTRENAR THIEF ==================\n', cyc);
        safeTrainScript('trainThief.m','Thief',cyc);
    end
end

function safeTrainScript(scriptName, roleName, cyc)
    maxAttempts = 2;   % 1 intento normal + 1 reintento

    for attempt = 1:maxAttempts
        % reset de persistentes entre intentos
        clear stepFcnPolice stepFcnThief

        try
            fprintf('(%s) Ciclo %d, intento %d...\n', roleName, cyc, attempt);
            run(scriptName);
            fprintf('(%s) Ciclo %d completado.\n', roleName, cyc);
            return;  % salir de la función si fue bien
        catch ME
            warning('selfplaytrain:%sError', roleName, ...
                'Error entrenando %s en ciclo %d, intento %d: %s', ...
                roleName, cyc, attempt, ME.message);

            % si no es el último intento, espera un poco y reintenta
            if attempt < maxAttempts
                pause(2);   % pequeña pausa por si fue algo transitorio
            else
                fprintf('(%s) Ciclo %d: se agotaron los reintentos, se continúa con el siguiente bloque.\n', ...
                        roleName, cyc);
            end
        end
    end
end
