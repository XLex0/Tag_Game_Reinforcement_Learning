function fname = saveAgentVersioned(agent, roleDir, stem)
% roleDir: 'agents_police' | 'agents_thief'
% stem:    'agent_police'  | 'agent_thief'
if ~exist(roleDir,'dir'), mkdir(roleDir); end
d = dir(fullfile(roleDir, [stem '_*.mat']));
ids = 0;
for k=1:numel(d)
    t = regexp(d(k).name,[stem '_(\d+)\.mat'],'tokens','once');
    if ~isempty(t), ids(end+1) = str2double(t{1}); end 
end
nextId = max(ids)+1;
fname = fullfile(roleDir, sprintf('%s_%d.mat', stem, nextId));
agentStruct = struct('agent', agent);  % para ser explícitos
save(fname, '-struct','agentStruct','-v7.3');
fprintf('Guardado: %s\n', fname);
end
