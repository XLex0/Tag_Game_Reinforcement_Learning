gpuDevice(1);

%% ==== 1) Crear entorno del equipo policía ====
envPolice = createEnvPolice();
obsInfoP = getObservationInfo(envPolice);
actInfoP = getActionInfo(envPolice);
numObsP  = obsInfoP.Dimension(1);
numActP  = numel(actInfoP.Elements);

%% ==== 2) Red Q(s,·) ====
criticNetP = [
    featureInputLayer(numObsP,'Normalization','none','Name','state')
    fullyConnectedLayer(256)
    reluLayer
    fullyConnectedLayer(200)
    reluLayer
    fullyConnectedLayer(128)
    reluLayer
    fullyConnectedLayer(numActP,'Name','Qout')];

%% ==== 3) Crítico DISCRETO con Representation API ====
% Si tu release no soporta 'UseDevice','gpu' aquí, quita esa opción.
criticOpts = rlRepresentationOptions('UseDevice','gpu');
criticP = rlQValueRepresentation( ...
    criticNetP, ...
    obsInfoP, ...
    actInfoP, ...
    'Observation', {'state'}, ...
    criticOpts);

%% ==== 4) Opciones DQN ====
agentOptsP = rlDQNAgentOptions;
agentOptsP.UseDoubleDQN = true;
agentOptsP.TargetUpdateFrequency = 1000;
agentOptsP.ExperienceBufferLength = 2e5;
agentOptsP.MiniBatchSize = 256;
agentOptsP.DiscountFactor = 0.99;
agentOptsP.EpsilonGreedyExploration.Epsilon      = 1.0;
agentOptsP.EpsilonGreedyExploration.EpsilonMin   = 0.05;
agentOptsP.EpsilonGreedyExploration.EpsilonDecay = 2e-4;

%% ==== 5) Agente DQN ====
agentPolice = rlDQNAgent(criticP, agentOptsP);

%% ==== 6) Pool paralelo ====
if isempty(gcp('nocreate'))
    parpool("local", 6);   % ajusta a tus núcleos físicos
end


%% ==== 7) Opciones de paralelización (compatibles con tu release) ====
useParallel = true;

parOpts = rl.option.ParallelTraining;
parOpts.Mode                  = 'async';         % mejor char que string
parOpts.DataToSendFromWorkers = 'Experiences';   % igual, en char
parOpts.StepsUntilDataIsSent  = 32;
parOpts.WorkerRandomSeeds     = -1;              % -1 = independent, -2 = identical

if ~exist('agents_police','dir'), mkdir agents_police; end

trainOptsP = rlTrainingOptions( ...
    'MaxEpisodes', 1000, ...
    'MaxStepsPerEpisode', 70, ...
    'UseParallel', useParallel, ...
    'ParallelizationOptions', parOpts, ...
    'Verbose', true, ...
    'Plots', 'training-progress', ...
    'StopTrainingCriteria','AverageReward', ...
    'StopTrainingValue', 800, ...
    'SaveAgentCriteria','EpisodeReward', ...
    'SaveAgentValue', 500, ...
    'SaveAgentDirectory','agents_police' ...
);

%% ==== 8) Entrenamiento ====
statsP = train(agentPolice, envPolice, trainOptsP);

saveAgentVersioned(agentPolice, 'agents_police','agent_police');

