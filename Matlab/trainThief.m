% ==== 1) Crear entorno del ladrón ====
envThief = createEnvThief();       % usa tu create + reset compartido
obsInfo = getObservationInfo(envThief);
actInfo = getActionInfo(envThief); % rlFiniteSetSpec con 9 acciones

numObs = obsInfo.Dimension(1);     % 6
numAct = numel(actInfo.Elements);  % 9

% ==== 2) Red Q (Q(s,a) sobre todas las acciones) ====
criticNet = [
    featureInputLayer(numObs,'Normalization','none','Name','state')
    fullyConnectedLayer(128,'Name','fc1')
    reluLayer
    fullyConnectedLayer(128,'Name','fc2')
    reluLayer
    fullyConnectedLayer(numAct,'Name','Qout')];

critic = rlQValueFunction(criticNet, obsInfo, actInfo, ...
    'ObservationInputNames','state');

% ==== 3) Opciones DQN ====
agentOpts = rlDQNAgentOptions;
agentOpts.UseDoubleDQN = true;
agentOpts.TargetUpdateFrequency = 1000;
agentOpts.ExperienceBufferLength = 1e5;
agentOpts.MiniBatchSize = 256;
agentOpts.DiscountFactor = 0.99;
agentOpts.EpsilonGreedyExploration.Epsilon      = 1.0;
agentOpts.EpsilonGreedyExploration.EpsilonMin   = 0.05;
agentOpts.EpsilonGreedyExploration.EpsilonDecay = 1e-4;  % ajusta según convergencia

agentThief = rlDQNAgent(critic, agentOpts);

% ==== 4) Opciones de entrenamiento ====
trainOpts = rlTrainingOptions( ...
    'MaxEpisodes', 5000, ...
    'MaxStepsPerEpisode', 500, ...
    'ScoreAveragingWindowLength', 100, ...
    'StopTrainingCriteria','AverageReward', ...
    'StopTrainingValue', 0.95, ...   % ajusta a tu escala de recompensa
    'SaveAgentCriteria','EpisodeReward', ...
    'SaveAgentValue', 1.0, ...
    'Verbose', true, ...
    'Plots','training-progress');

% ==== 5) Entrenar ====
trainingStatsThief = train(agentThief, envThief, trainOpts);
