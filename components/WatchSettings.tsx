import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Bell, Edit2, Save, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { WatchRule, WatchCondition, WatchConditionType, WatchOperator } from '../types';
import {
  loadWatchRules,
  saveWatchRules,
  addWatchRule,
  updateWatchRule,
  deleteWatchRule,
} from '../services/watchService';

interface WatchSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  availableCoins: Array<{ symbol: string; name: string }>;
}

const CONDITION_TYPES: Array<{ value: WatchConditionType; label: string }> = [
  { value: 'news_risk_tag', label: '뉴스 리스크 태그' },
  { value: 'social_negative', label: '소셜 부정 비율 (%)' },
  { value: 'price_change', label: '가격 변동 (%)' },
  { value: 'risk_score', label: '리스크 점수' },
  { value: 'risk_level', label: '리스크 레벨' },
];

const OPERATORS: Array<{ value: WatchOperator; label: string }> = [
  { value: '>', label: '초과' },
  { value: '>=', label: '이상' },
  { value: '<', label: '미만' },
  { value: '<=', label: '이하' },
  { value: '==', label: '같음' },
];

const RISK_TAGS = ['hack', 'exploit', 'fraud', 'market_crash', 'exchange_issue', 'regulation', 'lawsuit', 'technical'];
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];

// 커스텀 드롭다운 컴포넌트
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:border-indigo-300 transition-colors flex items-center justify-between text-left"
      >
        <span className={selectedOption ? 'text-slate-800' : 'text-slate-400'}>
          {selectedOption ? selectedOption.label : placeholder || '선택하세요'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-sm font-medium text-left hover:bg-indigo-50 transition-colors flex items-center justify-between ${
                value === option.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'
              }`}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const WatchSettings: React.FC<WatchSettingsProps> = ({ isOpen, onClose, availableCoins }) => {
  const [rules, setRules] = useState<WatchRule[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCoins, setNewRuleCoins] = useState<string[]>([]);
  const [newRuleAllCoins, setNewRuleAllCoins] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setRules(loadWatchRules());
    }
  }, [isOpen]);

  const handleAddRule = () => {
    if (!newRuleName.trim()) return;
    
    const rule = addWatchRule({
      name: newRuleName.trim(),
      enabled: true,
      coinSymbols: newRuleAllCoins ? null : newRuleCoins,
      conditions: [],
    });
    
    setRules([...rules, rule]);
    setNewRuleName('');
    setNewRuleCoins([]);
    setNewRuleAllCoins(true);
    setEditingRuleId(rule.id);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('이 Watch를 삭제하시겠습니까?')) {
      deleteWatchRule(id);
      setRules(rules.filter(r => r.id !== id));
      if (editingRuleId === id) {
        setEditingRuleId(null);
      }
    }
  };

  const handleToggleEnabled = (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (rule) {
      updateWatchRule(id, { enabled: !rule.enabled });
      setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    }
  };

  const handleAddCondition = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      const newCondition: WatchCondition = {
        type: 'price_change',
        operator: '>',
        value: 5,
      };
      const updated = {
        ...rule,
        conditions: [...rule.conditions, newCondition],
      };
      updateWatchRule(ruleId, updated);
      setRules(rules.map(r => r.id === ruleId ? updated : r));
    }
  };

  const handleUpdateCondition = (ruleId: string, conditionIndex: number, updates: Partial<WatchCondition>) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      const updatedConditions = [...rule.conditions];
      updatedConditions[conditionIndex] = {
        ...updatedConditions[conditionIndex],
        ...updates,
      };
      const updated = {
        ...rule,
        conditions: updatedConditions,
      };
      updateWatchRule(ruleId, updated);
      setRules(rules.map(r => r.id === ruleId ? updated : r));
    }
  };

  const handleDeleteCondition = (ruleId: string, conditionIndex: number) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      const updatedConditions = rule.conditions.filter((_, i) => i !== conditionIndex);
      const updated = {
        ...rule,
        conditions: updatedConditions,
      };
      updateWatchRule(ruleId, updated);
      setRules(rules.map(r => r.id === ruleId ? updated : r));
    }
  };

  const handleUpdateRuleCoins = (ruleId: string, coinSymbols: string[] | null) => {
    updateWatchRule(ruleId, { coinSymbols });
    setRules(rules.map(r => r.id === ruleId ? { ...r, coinSymbols } : r));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[2.5rem] p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Bell className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Watch 설정</h2>
              <p className="text-sm text-slate-500">원하는 시장 신호를 감지하면 알림을 받습니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* 새 Watch 추가 */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <Plus className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">새 Watch 추가</h3>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Watch 이름 (예: 해킹 뉴스 감지)"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
            />
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">적용 코인</label>
              <CustomSelect
                value={newRuleAllCoins ? 'all' : (newRuleCoins[0] || 'all')}
                onChange={(value) => {
                  if (value === 'all') {
                    setNewRuleAllCoins(true);
                    setNewRuleCoins([]);
                  } else {
                    setNewRuleAllCoins(false);
                    setNewRuleCoins([value]);
                  }
                }}
                options={[
                  { value: 'all', label: '전체 코인' },
                  ...availableCoins.map(coin => ({
                    value: coin.symbol,
                    label: `${coin.name} (${coin.symbol})`
                  }))
                ]}
              />
            </div>
            <button
              onClick={handleAddRule}
              disabled={!newRuleName.trim()}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Watch 추가
            </button>
          </div>
        </div>

        {/* Watch 목록 */}
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>아직 Watch가 없습니다. 위에서 새 Watch를 추가해주세요.</p>
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={`border-2 rounded-2xl p-5 transition-all ${
                  rule.enabled
                    ? 'border-indigo-200 bg-indigo-50/30'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => handleToggleEnabled(rule.id)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        rule.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">{rule.name}</h3>
                      <p className="text-xs text-slate-500">
                        {rule.coinSymbols && rule.coinSymbols.length > 0
                          ? `${rule.coinSymbols.join(', ')}에만 적용`
                          : '전체 코인에 적용'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingRuleId(editingRuleId === rule.id ? null : rule.id)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                    >
                      <Edit2 className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-rose-50 hover:border-rose-200"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </button>
                  </div>
                </div>

                {editingRuleId === rule.id && (
                  <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
                    {/* 코인 선택 */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">적용 코인</label>
                      <CustomSelect
                        value={!rule.coinSymbols || rule.coinSymbols.length === 0 ? 'all' : rule.coinSymbols[0] || 'all'}
                        onChange={(value) => {
                          if (value === 'all') {
                            handleUpdateRuleCoins(rule.id, null);
                          } else {
                            handleUpdateRuleCoins(rule.id, [value]);
                          }
                        }}
                        options={[
                          { value: 'all', label: '전체 코인' },
                          ...availableCoins.map(coin => ({
                            value: coin.symbol,
                            label: `${coin.name} (${coin.symbol})`
                          }))
                        ]}
                      />
                    </div>

                    {/* 조건 목록 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-bold text-slate-700">조건</label>
                        <button
                          onClick={() => handleAddCondition(rule.id)}
                          className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          조건 추가
                        </button>
                      </div>
                      {rule.conditions.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                          조건이 없습니다. 조건을 추가해주세요.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {rule.conditions.map((condition, index) => (
                            <div
                              key={index}
                              className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3"
                            >
                              <select
                                value={condition.type}
                                onChange={(e) =>
                                  handleUpdateCondition(rule.id, index, {
                                    type: e.target.value as WatchConditionType,
                                    value: condition.type === 'risk_level' ? 'LOW' : condition.type === 'news_risk_tag' ? '' : 0,
                                    riskTag: undefined,
                                  })
                                }
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                {CONDITION_TYPES.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>

                              {condition.type === 'news_risk_tag' ? (
                                <select
                                  value={condition.riskTag || ''}
                                  onChange={(e) =>
                                    handleUpdateCondition(rule.id, index, { riskTag: e.target.value })
                                  }
                                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">태그 선택</option>
                                  {RISK_TAGS.map((tag) => (
                                    <option key={tag} value={tag}>
                                      {tag}
                                    </option>
                                  ))}
                                </select>
                              ) : condition.type === 'risk_level' ? (
                                <select
                                  value={condition.value as string}
                                  onChange={(e) =>
                                    handleUpdateCondition(rule.id, index, { value: e.target.value })
                                  }
                                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  {RISK_LEVELS.map((level) => (
                                    <option key={level} value={level}>
                                      {level}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <>
                                  <select
                                    value={condition.operator}
                                    onChange={(e) =>
                                      handleUpdateCondition(rule.id, index, {
                                        operator: e.target.value as WatchOperator,
                                      })
                                    }
                                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    {OPERATORS.map((op) => (
                                      <option key={op.value} value={op.value}>
                                        {op.label}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    value={condition.value as number}
                                    onChange={(e) =>
                                      handleUpdateCondition(rule.id, index, {
                                        value: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    step="0.1"
                                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 w-24"
                                    placeholder="값"
                                  />
                                </>
                              )}

                              <button
                                onClick={() => handleDeleteCondition(rule.id, index)}
                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {rule.conditions.length > 0 && editingRuleId !== rule.id && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex flex-wrap gap-2">
                      {rule.conditions.map((condition, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
                        >
                          {CONDITION_TYPES.find(t => t.value === condition.type)?.label}{' '}
                          {condition.type !== 'news_risk_tag' && condition.type !== 'risk_level' && (
                            <>
                              {OPERATORS.find(o => o.value === condition.operator)?.label}{' '}
                              {condition.value}
                            </>
                          )}
                          {condition.type === 'news_risk_tag' && condition.riskTag && (
                            <>: {condition.riskTag}</>
                          )}
                          {condition.type === 'risk_level' && (
                            <>: {condition.value}</>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

