function env = createEnvPolice()
    % Observación: [thief(x,y), p0(x,y), p1(x,y), d0, d1]  -> 8x1
    obsInfo = rlNumericSpec([8 1], ...
        'Name','state', ...
        'Description','[thief(x,y), p0(x,y), p1(x,y), d0, d1]');

    moves = [-1 -1; -1 0; -1 1; 0 -1; 0 0; 0 1; 1 -1; 1 0; 1 1];

    A = zeros(81,4); k = 1;
    for i = 1:9, for j = 1:9
        A(k,:) = [moves(i,:), moves(j,:)]; k = k + 1;
    end, end
    actions = num2cell(A,2);

    actInfo = rlFiniteSetSpec(actions, ...
        'Name','aPoliceTeam', ...
        'Description','Acción conjunta: p0(dx,dy), p1(dx,dy)');

    env = rlFunctionEnv(obsInfo, actInfo, @stepFcnPolice, @resetFcn);
    validateEnvironment(env);
end
