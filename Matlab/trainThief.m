gpuDevice(1);

%% ==== 1) Crear entorno del ladrón ====
envThief = createEnvThief();   % Debe devolver obs 8x1: [tx ty p0x p0y p1x p1y d0 d1]
obsInfoT = getObservationInfo(envThief);
actInfoT = getActionInfo(envThief);
numObsT  = obsInfoT.Dimension(1);        % 8
numActT  = numel(actInfoT.Elements);     % 9

%% ==== 2) Red Q(s,·) 
criticNetT = [
    featureInputLayer(numObsT,'Normalization','none','Name','state')
    fullyConnectedLayer(200)
    reluLayer
    fullyConnectedLayer(128)
    reluLayer
    fullyConnectedLayer(64)
    reluLayer
    fullyConnectedLayer(numActT,'Name','Qout')];

%% ==== 3) Crítico DISCRETO con Representation API (GPU) ====
% Si tu release no soporta 'UseDevice','gpu' aquí, quítalo o pon 'cpu'.
criticOptsT = rlRepresentationOptions('UseDevice','gpu');
criticT = rlQValueRepresentation( ...
    criticNetT, ...
    obsInfoT, ...
    actInfoT, ...
    'Observation', {'state'}, ...
    criticOptsT);

%% ==== 4) Opciones DQN (paridad con Police) ====
agentOptsT = rlDQNAgentOptions;
agentOptsT.UseDoubleDQN = true;
agentOptsT.TargetUpdateFrequency = 1000;
agentOptsT.ExperienceBufferLength = 2e5;
agentOptsT.MiniBatchSize = 256;
agentOptsT.DiscountFactor = 0.99;
agentOptsT.EpsilonGreedyExploration.Epsilon      = 1.0;
agentOptsT.EpsilonGreedyExploration.EpsilonMin   = 0.05;
agentOptsT.EpsilonGreedyExploration.EpsilonDecay = 2e-4;

%% ==== 5) Agente DQN ====
agentThief = rlDQNAgent(criticT, agentOptsT);

%% ==== 6) Pool paralelo ====
if isempty(gcp('nocreate'))
    parpool("local", 6);   % ajusta a tus núcleos físicos
end

%% ==== 7) Opciones de paralelización (mismas que Police) ====
useParallel = true;

parOpts = rl.option.ParallelTraining;
parOpts.Mode                  = 'async';         % mejor char que string
parOpts.DataToSendFromWorkers = 'Experiences';
parOpts.StepsUntilDataIsSent  = 32;
parOpts.WorkerRandomSeeds     = -1;              % -1 = independent, -2 = identical

if ~exist('agents_thief','dir'), mkdir agents_thief; end

%% ==== 8) Opciones de entrenamiento ====
% Nota: la escala de recompensa del thief suele ser menor que la de Police.
% Ajusta StopTrainingValue/SaveAgentValue a tus métricas reales.
trainOptsT = rlTrainingOptions( ...
    'MaxEpisodes', 1000, ...
    'MaxStepsPerEpisode', 70, ...
    'UseParallel', useParallel, ...
    'ParallelizationOptions', parOpts, ...
    'Verbose', true, ...
    'Plots', 'training-progress', ...
    'StopTrainingCriteria','AverageReward', ...
    'StopTrainingValue', 3.0, ...          % << AJUSTA según tu shaping real
    'SaveAgentCriteria','EpisodeReward', ...
    'SaveAgentValue', 2.0, ...             % << AJUSTA
    'SaveAgentDirectory','agents_thief' ...
);

%% ==== 9) Entrenamiento ====
statsT = train(agentThief, envThief, trainOptsT);

saveAgentVersioned(agentThief,   'agents_thief','agent_thief');