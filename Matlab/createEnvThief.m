function env = createEnvThief()
    % Observación: [thief(x,y), p0(x,y), p1(x,y), d0, d1]  -> 8x1
    obsInfo = rlNumericSpec([8 1], ...
        'Name','state', ...
        'Description','[thief(x,y), p0(x,y), p1(x,y), d0, d1]');

    % Acciones discretas: 9 pares (dx, dy) con dx,dy ∈ {-1,0,1}
    moves = [-1 -1;
             -1  0;
             -1  1;
              0 -1;
              0  0;
              0  1;
              1 -1;
              1  0;
              1  1];

    actions = num2cell(moves, 2);  % 9x1 celdas, cada celda = [dx dy]

    actInfo = rlFiniteSetSpec(actions, ...
        'Name','aThief', ...
        'Description','Movimiento discreto del ladrón (dx,dy)');

    env = rlFunctionEnv(obsInfo, actInfo, @stepFcnThief, @resetFcn);
    validateEnvironment(env);
end
