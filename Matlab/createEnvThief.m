function env = createEnvThief()
    % --- Observaciones: [thief(x,y), p0(x,y), p1(x,y)]
    obsInfo = rlNumericSpec([6 1], ...
        'Name','state', ...
        'Description','[thief(x,y), p0(x,y), p1(x,y)]');

    % --- Acciones discretas: 9 pares posibles (dx, dy) con dx,dy ∈ {-1,0,1}
    A = [-1 -1;
         -1  0;
         -1  1;
          0 -1;
          0  0;
          0  1;
          1 -1;
          1  0;
          1  1];

    actions = num2cell(A, 2);  % 9x1 celdas, cada una es [dx dy]
    actInfo = rlFiniteSetSpec(actions, ...
        'Name','aThief', ...
        'Description','Movimiento discreto del ladrón (dx,dy)');

    env = rlFunctionEnv(obsInfo, actInfo, @stepFcnThief, @resetFcn);
    validateEnvironment(env);
end
