package br.com.totvs.insights.model;

import jakarta.persistence.*;

@Entity
@Table(name = "TB_ALERTA_CHURN")
@PrimaryKeyJoinColumn(name = "ALERTA_ID")
public class AlertaChurn extends Alerta {

    @Column(name = "IN_RISCO_ATIVO", length = 1, nullable = false)
    private String riscoEvasaoAtivo; // 'S' ou 'N' (Check Constraint)

    public AlertaChurn() {}

    public String getRiscoEvasaoAtivo() { return riscoEvasaoAtivo; }
    public void setRiscoEvasaoAtivo(String riscoEvasaoAtivo) { this.riscoEvasaoAtivo = riscoEvasaoAtivo; }

    @Override
    public String processarGatilhoOperacional() {
        if ("S".equals(this.riscoEvasaoAtivo)) {
            return "TRIGGER_ALERT: Encaminhar contrato imediatamente para retenção prioritária de CS.";
        }
        return "TRIGGER_INFO: Conta monitorada em conformidade basal.";
    }
}