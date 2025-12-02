function [agent, fname] = pickAgentWeighted(roleDir, stem)
%
% roleDir: carpeta, ej. 'agents_police' o 'agents_thief'
% stem:    prefijo, ej. 'agent_police' o 'agent_thief'
%
% Regla de selección:
%   - 40% de probabilidad: el último modelo (mayor índice).
%   - 60% restante: distribuido entre el resto, con más peso a los recientes.

    pattern = fullfile(roleDir, sprintf('%s_*.mat', stem));

    d = dir(pattern);
    if isempty(d)
        error('No se encontraron modelos con el patrón: %s', pattern);
    end
    % --- extraer índices numéricos ---
    ids = nan(1, numel(d));
    for k = 1:numel(d)
        t = regexp(d(k).name, [stem '_(\d+)\.mat'], 'tokens', 'once');
        if ~isempty(t)
            ids(k) = str2double(t{1});
        end
    end
    % quitar los que no matchean bien
    valid = ~isnan(ids);
    d = d(valid);
    ids = ids(valid);

    if isempty(d)
        error('No se encontraron archivos que cumplan el patrón %s_#.mat', stem);
    end

    % --- ordenar por índice (de más viejo a más nuevo) ---
    [ids, order] = sort(ids);
    d = d(order);

    n = numel(d);

    % caso trivial: solo hay un modelo
    if n == 1
        fname = fullfile(roleDir, d(1).name);
        s = load(fname);
        agent = s.agent;
        fprintf('Solo hay un modelo. Seleccionado: %s (id=%d)\n', fname, ids(1));
        return;
    end

    % --- construir distribución de probabilidad ---
    % 40% para el último (más nuevo)
    p_last = 0.40;

    % 60% repartido entre los n-1 restantes, con peso creciente
    % pesos base: 1,2,3,...,(n-1)
    w = 1:(n-1);
    w = w / sum(w);          % normalizar a 1
    w = w * 0.60;            % que sumen 0.6

    probs = [w, p_last];     % tamaño n
    cumProbs = cumsum(probs);

    % --- muestreo ---
    r = rand();
    idx = find(r <= cumProbs, 1, 'first');

    fname = fullfile(roleDir, d(idx).name);
    s = load(fname);
    agent = s.agent;

    fprintf('Seleccionado: %s (id=%d)\n', fname, ids(idx));
end
